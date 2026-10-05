import type { Client, Tag, Trip, TripCurrency, TripFilters, TripStatus } from "@/types";

export type TripFilterListItem = Pick<
  Trip,
  "title" | "status" | "startDate" | "endDate" | "currency" | "instructions" | "assignedAgentId"
> & {
  clients: Client[];
  tags: Tag[];
  internalNotes?: string | null;
};

/** Vocabulario literal usado por el parser de URL. Movido desde DashboardFilters.tsx. */
export const TRIP_FILTER_STATUSES: TripStatus[] = ["draft", "published", "archived"];

/** Vocabulario literal usado por el parser de URL. Movido desde DashboardFilters.tsx. */
export const TRIP_FILTER_CURRENCIES: TripCurrency[] = ["MXN", "USD", "EUR"];

/** Lista congelada de claves borradas antes de re-sincronizar la URL. Movida verbatim desde DashboardFilters.tsx. */
export const TRIP_FILTER_URL_KEYS = [
  "q",
  "status",
  "dateFrom",
  "dateTo",
  "client",
  "tags",
  "agent",
  "currency",
  "page",
  "clientsPage",
] as const;

export function normalizeFilterText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Parsea el query string a filtros. Movida verbatim desde DashboardFilters.tsx. */
export function deserializeTripFilters(searchParams: URLSearchParams): Partial<TripFilters> {
  const filters: Partial<TripFilters> = {};
  const q = searchParams.get("q");
  if (q) filters.query = q;
  const status = searchParams.get("status");
  if (status) {
    const valid = status.split(",").filter((s): s is TripStatus =>
      TRIP_FILTER_STATUSES.includes(s as TripStatus),
    );
    if (valid.length) filters.status = valid;
  }
  const dateFrom = searchParams.get("dateFrom");
  if (dateFrom) filters.dateFrom = dateFrom;
  const dateTo = searchParams.get("dateTo");
  if (dateTo) filters.dateTo = dateTo;
  const client = searchParams.get("client");
  if (client) filters.clientIds = client.split(",");
  const tags = searchParams.get("tags");
  if (tags) filters.tagIds = tags.split(",");
  const agent = searchParams.get("agent");
  if (agent) filters.agentIds = agent.split(",");
  const currency = searchParams.get("currency") as TripCurrency | null;
  if (currency && TRIP_FILTER_CURRENCIES.includes(currency)) filters.currency = currency;
  return filters;
}

/** Descarta los valores vacíos de un objeto de filtros. Movida verbatim desde DashboardFilters.tsx. */
export function cleanTripFilters(f: Partial<TripFilters>): Partial<TripFilters> {
  const next = { ...f };
  if (!next.query) delete next.query;
  if (!next.status?.length) delete next.status;
  if (!next.dateFrom) delete next.dateFrom;
  if (!next.dateTo) delete next.dateTo;
  if (!next.clientIds?.length) delete next.clientIds;
  if (!next.tagIds?.length) delete next.tagIds;
  if (!next.agentIds?.length) delete next.agentIds;
  if (!next.currency) delete next.currency;
  return next;
}

/**
 * Núcleo puro de `syncUrl`. Borra `TRIP_FILTER_URL_KEYS` de `current` y luego
 * setea cada filtro no vacío. Preserva los params ajenos. Movida verbatim
 * desde DashboardFilters.tsx.
 */
export function buildTripFilterSearchParams(
  current: URLSearchParams,
  filters: Partial<TripFilters>,
): URLSearchParams {
  const params = new URLSearchParams(current.toString());
  TRIP_FILTER_URL_KEYS.forEach((key) => params.delete(key));

  if (filters.query) params.set("q", filters.query);
  if (filters.status?.length) params.set("status", filters.status.join(","));
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (filters.clientIds?.length) params.set("client", filters.clientIds.join(","));
  if (filters.tagIds?.length) params.set("tags", filters.tagIds.join(","));
  if (filters.agentIds?.length) params.set("agent", filters.agentIds.join(","));
  if (filters.currency) params.set("currency", filters.currency);

  return params;
}

export function hasActiveTripFilters(filters: Partial<TripFilters>) {
  return Boolean(
    filters.query?.trim() ||
      filters.status?.length ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.clientIds?.length ||
      filters.tagIds?.length ||
      filters.agentIds?.length ||
      filters.currency,
  );
}

export function tripMatchesFilters(trip: TripFilterListItem, filters: Partial<TripFilters>) {
  if (filters.status?.length && !filters.status.includes(trip.status)) return false;
  if (filters.tagIds?.length && !trip.tags.some((tag) => filters.tagIds!.includes(tag.id))) return false;
  if (filters.clientIds?.length && !trip.clients.some((client) => filters.clientIds!.includes(client.id))) {
    return false;
  }
  if (filters.agentIds?.length && !filters.agentIds.includes(trip.assignedAgentId ?? "")) {
    return false;
  }
  if (filters.currency && trip.currency !== filters.currency) return false;

  if (filters.dateFrom || filters.dateTo) {
    const tripStart = new Date(`${trip.startDate}T00:00:00`);
    const tripEnd = new Date(`${trip.endDate}T00:00:00`);
    const dateFrom = filters.dateFrom ? new Date(`${filters.dateFrom}T00:00:00`) : null;
    const dateTo = filters.dateTo ? new Date(`${filters.dateTo}T00:00:00`) : null;
    if (dateFrom && tripEnd < dateFrom) return false;
    if (dateTo && tripStart > dateTo) return false;
  }

  const normalizedQuery = normalizeFilterText(filters.query?.trim() ?? "");
  if (normalizedQuery) {
    const haystack = [
      trip.title,
      trip.instructions,
      trip.internalNotes,
      ...trip.clients.map((client) => client.name),
    ]
      .filter((value): value is string => Boolean(value))
      .map(normalizeFilterText)
      .join(" ");
    if (!haystack.includes(normalizedQuery)) return false;
  }

  return true;
}

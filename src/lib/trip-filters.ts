import type { Client, Tag, Trip, TripFilters } from "@/types";

export type TripFilterListItem = Pick<
  Trip,
  "title" | "status" | "startDate" | "endDate" | "currency" | "instructions"
> & {
  clients: Client[];
  tags: Tag[];
  internalNotes?: string | null;
};

export function normalizeFilterText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function hasActiveTripFilters(filters: Partial<TripFilters>) {
  return Boolean(
    filters.query?.trim() ||
      filters.status?.length ||
      filters.dateFrom ||
      filters.dateTo ||
      filters.clientIds?.length ||
      filters.tagIds?.length ||
      filters.currency,
  );
}

export function tripMatchesFilters(trip: TripFilterListItem, filters: Partial<TripFilters>) {
  if (filters.status?.length && !filters.status.includes(trip.status)) return false;
  if (filters.tagIds?.length && !trip.tags.some((tag) => filters.tagIds!.includes(tag.id))) return false;
  if (filters.clientIds?.length && !trip.clients.some((client) => filters.clientIds!.includes(client.id))) {
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

import Link from "next/link";
import type { ReactNode } from "react";
import { ALL_CLIENTS_PAGE_SIZE, DEFAULT_PAGE_SIZE, getClients, getTags, getTravelAgents, getTripsWithClients } from "@/lib/data";
import { hasActiveTripFilters } from "@/lib/trip-filters";
import type { TripCurrency, TripFilters, TripStatus } from "@/types";
import { TripsExplorer } from "./TripsExplorer";

type SearchParamValue = string | string[] | undefined;
type TripsPageSearchParams = Record<string, SearchParamValue>;

const VALID_STATUSES: TripStatus[] = ["draft", "published", "archived"];
const VALID_CURRENCIES: TripCurrency[] = ["MXN", "USD", "EUR"];

export default async function TripsIndexPage({
  searchParams,
}: {
  searchParams: Promise<TripsPageSearchParams>;
}) {
  const params = await searchParams;
  const { filters, page } = parseTripsSearchParams(params);
  const [{ items: trips, totalCount }, { items: clients }, tags, travelAgents] = await Promise.all([
    getTripsWithClients({ filters, page, pageSize: DEFAULT_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTags(),
    getTravelAgents(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section data-testid="trips-summary-hero" className="relative mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7 sm:py-7">
        <div aria-hidden="true" className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_75%_35%,rgba(245,164,0,0.42),transparent_12%),linear-gradient(135deg,transparent_15%,rgba(255,255,255,0.1)_15%,transparent_32%,rgba(37,16,27,0.28)_32%)] lg:block" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Mis viajes</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
              Encuentra, filtra y gestiona los viajes de tus clientes desde una vista dedicada.
            </p>
            <p className="mt-5 text-sm font-medium text-[var(--operator-accent)]">
              {totalCount} viaje{totalCount !== 1 ? "s" : ""} en esta vista
            </p>
          </div>
          <Link
            href="/dashboard/trips/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--operator-accent)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--operator-accent-foreground)] shadow-[var(--operator-shadow-action)] transition hover:bg-[var(--operator-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            + Nuevo viaje
          </Link>
        </div>
      </section>

      <TripsExplorer
        trips={trips}
        clients={clients}
        tags={tags}
        travelAgents={travelAgents}
        initialFilters={filters}
        hasActiveFilters={hasActiveTripFilters(filters)}
        totalCount={totalCount}
        pagination={
          <TripsPagination
            currentPage={page}
            totalPages={totalPages}
            params={params}
          />
        }
      />
    </main>
  );
}

function parseTripsSearchParams(params: TripsPageSearchParams) {
  const filters: Partial<TripFilters> = {};
  const query = firstParam(params.q)?.trim();
  if (query) filters.query = query;

  const status = parseCsv(params.status).filter((value): value is TripStatus =>
    VALID_STATUSES.includes(value as TripStatus),
  );
  if (status.length) filters.status = [...new Set(status)];

  const dateFrom = firstParam(params.dateFrom);
  if (isDateParam(dateFrom)) filters.dateFrom = dateFrom;
  const dateTo = firstParam(params.dateTo);
  if (isDateParam(dateTo)) filters.dateTo = dateTo;

  const clientIds = parseCsv(params.client);
  if (clientIds.length) filters.clientIds = clientIds;
  const tagIds = parseCsv(params.tags);
  if (tagIds.length) filters.tagIds = tagIds;
  const agentIds = parseCsv(params.agent);
  if (agentIds.length) filters.agentIds = agentIds;

  const currency = firstParam(params.currency);
  if (VALID_CURRENCIES.includes(currency as TripCurrency)) {
    filters.currency = currency as TripCurrency;
  }

  return { filters, page: parsePageParam(params.page) };
}

function TripsPagination({
  currentPage,
  totalPages,
  params,
}: {
  currentPage: number;
  totalPages: number;
  params: TripsPageSearchParams;
}) {
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Paginación de viajes">
      <PaginationLink page={currentPage - 1} params={params} disabled={currentPage <= 1}>
        ← Anterior
      </PaginationLink>
      <span className="text-[var(--operator-ink-muted)]">
        Página {currentPage} de {totalPages}
      </span>
      <PaginationLink page={currentPage + 1} params={params} disabled={currentPage >= totalPages}>
        Siguiente →
      </PaginationLink>
    </nav>
  );
}

function PaginationLink({
  page,
  params,
  disabled,
  children,
}: {
  page: number;
  params: TripsPageSearchParams;
  disabled: boolean;
  children: ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-[var(--operator-ink-subtle)] opacity-60">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/dashboard/trips?${buildPageHref(params, page)}`}
      className="rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-1.5 text-[var(--operator-brand)] transition hover:border-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]"
    >
      {children}
    </Link>
  );
}

function buildPageHref(params: TripsPageSearchParams, page: number) {
  const next = new URLSearchParams();
  (["q", "status", "dateFrom", "dateTo", "client", "tags", "agent", "currency"] as const).forEach((key) => {
    const value = firstParam(params[key]);
    if (value) next.set(key, value);
  });
  if (page > 1) next.set("page", String(page));
  return next.toString();
}

function firstParam(value: SearchParamValue) {
  return Array.isArray(value) ? value[0] : value;
}

function parseCsv(value: SearchParamValue) {
  return (firstParam(value) ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePageParam(value: SearchParamValue) {
  const raw = firstParam(value);
  const parsed = raw ? Number.parseInt(raw, 10) : 1;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function isDateParam(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

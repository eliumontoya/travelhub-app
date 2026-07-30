import Link from "next/link";
import type { ReactNode } from "react";
import { ALL_CLIENTS_PAGE_SIZE, DEFAULT_PAGE_SIZE, getClients, getTags, getTripsWithClients } from "@/lib/data";
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
  const [{ items: trips, totalCount }, { items: clients }, tags] = await Promise.all([
    getTripsWithClients({ filters, page, pageSize: DEFAULT_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTags(),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Viajes</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mis viajes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Encuentra, filtra y gestiona los viajes de tus clientes desde una vista dedicada.
          </p>
        </div>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          + Nuevo viaje
        </Link>
      </div>

      <TripsExplorer
        trips={trips}
        clients={clients}
        tags={tags}
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
      <span className="text-gray-500 dark:text-gray-400">
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
      <span className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-300 dark:border-gray-800 dark:text-gray-600">
        {children}
      </span>
    );
  }

  return (
    <Link
      href={`/dashboard/trips?${buildPageHref(params, page)}`}
      className="rounded-lg border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
    >
      {children}
    </Link>
  );
}

function buildPageHref(params: TripsPageSearchParams, page: number) {
  const next = new URLSearchParams();
  (["q", "status", "dateFrom", "dateTo", "client", "tags", "currency"] as const).forEach((key) => {
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

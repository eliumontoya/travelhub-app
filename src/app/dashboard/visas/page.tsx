import Link from "next/link";
import type { ReactNode } from "react";
import {
  ALL_CLIENTS_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
  getClients,
  getVisasWithClients,
} from "@/lib/data";
import { requireFeature } from "@/lib/auth/roles";
import type { VisaFilters, VisaStatus } from "@/types";
import { VisasExplorer } from "./VisasExplorer";

type SearchParamValue = string | string[] | undefined;
type VisasPageSearchParams = Record<string, SearchParamValue>;

const VALID_STATUSES: VisaStatus[] = ["pending", "in_progress", "completed"];

export default async function VisasIndexPage({
  searchParams,
}: {
  searchParams: Promise<VisasPageSearchParams>;
}) {
  await requireFeature("visas");
  const params = await searchParams;
  const { filters, page } = parseVisasSearchParams(params);
  const [{ items: visas, totalCount }, { items: clients }] = await Promise.all([
    getVisasWithClients({ filters, page, pageSize: DEFAULT_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section
        data-testid="visas-summary-hero"
        className="relative mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7 sm:py-7"
      >
        <div
          aria-hidden="true"
          className="absolute inset-y-0 right-0 hidden w-2/5 bg-[radial-gradient(circle_at_75%_35%,rgba(245,164,0,0.42),transparent_12%),linear-gradient(135deg,transparent_15%,rgba(255,255,255,0.1)_15%,transparent_32%,rgba(37,16,27,0.28)_32%)] lg:block"
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
              Servicio de visas
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">
              Visas
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/85 sm:text-base">
              Gestiona las solicitudes de visa de tus clientes, asigna viajeros y
              sigue el ciclo de aprobación por país/consulado.
            </p>
            <p className="mt-5 text-sm font-medium text-[var(--operator-accent)]">
              {totalCount} visa{totalCount !== 1 ? "s" : ""} en esta vista
            </p>
          </div>
          <Link
            href="/dashboard/visas/new"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--operator-accent)] px-4 py-2.5 text-center text-sm font-semibold text-[var(--operator-accent-foreground)] shadow-[var(--operator-shadow-action)] transition hover:bg-[var(--operator-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            + Nueva visa
          </Link>
        </div>
      </section>

      <VisasExplorer
        key={JSON.stringify(filters)}
        visas={visas}
        clients={clients}
        initialFilters={filters}
        hasActiveFilters={hasActiveVisaFilters(filters)}
        totalCount={totalCount}
        pagination={
          <VisasPagination currentPage={page} totalPages={totalPages} params={params} />
        }
      />
    </main>
  );
}

function parseVisasSearchParams(params: VisasPageSearchParams) {
  const filters: Partial<VisaFilters> = {};

  const query = firstParam(params.q)?.trim();
  if (query) filters.query = query;

  const status = parseCsv(params.status).filter((value): value is VisaStatus =>
    VALID_STATUSES.includes(value as VisaStatus),
  );
  if (status.length) filters.status = [...new Set(status)];

  const clientIds = parseCsv(params.client);
  if (clientIds.length) filters.clientIds = clientIds;

  const country = firstParam(params.country)?.trim();
  if (country) filters.country = country;

  return { filters, page: parsePageParam(params.page) };
}

function hasActiveVisaFilters(filters: Partial<VisaFilters>): boolean {
  return Boolean(
    filters.query ||
      (filters.status && filters.status.length > 0) ||
      (filters.clientIds && filters.clientIds.length > 0) ||
      filters.country,
  );
}

function VisasPagination({
  currentPage,
  totalPages,
  params,
}: {
  currentPage: number;
  totalPages: number;
  params: VisasPageSearchParams;
}) {
  return (
    <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Paginación de visas">
      <PaginationLink page={currentPage - 1} params={params} disabled={currentPage <= 1}>
        ← Anterior
      </PaginationLink>
      <span className="text-[var(--operator-ink-muted)]">
        Página {currentPage} de {totalPages}
      </span>
      <PaginationLink
        page={currentPage + 1}
        params={params}
        disabled={currentPage >= totalPages}
      >
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
  params: VisasPageSearchParams;
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
      href={`/dashboard/visas?${buildPageHref(params, page)}`}
      className="rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-1.5 text-[var(--operator-brand)] transition hover:border-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]"
    >
      {children}
    </Link>
  );
}

function buildPageHref(params: VisasPageSearchParams, page: number) {
  const next = new URLSearchParams();
  (["q", "status", "client", "country"] as const).forEach((key) => {
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

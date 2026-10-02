"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Client, Visa, VisaFilters, VisaStatus } from "@/types";

type VisaListItem = Visa & { clients: Client[] };

const STATUS_META: Record<VisaStatus, { label: string; classes: string }> = {
  pending: {
    label: "Pendiente",
    classes:
      "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)]",
  },
  in_progress: {
    label: "En trámite",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  completed: {
    label: "Completada",
    classes: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
};

const STATUS_OPTIONS: VisaStatus[] = ["pending", "in_progress", "completed"];

function formatDate(value: string): string {
  // Accepts YYYY-MM-DD or ISO timestamps; renders a short date in es-MX.
  const date = value.length === 10 ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function VisaStatusBadge({ status }: { status: VisaStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      data-testid={`visa-status-${status}`}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${meta.classes}`}
    >
      {meta.label}
    </span>
  );
}

export function VisasExplorer({
  visas,
  clients,
  initialFilters,
  hasActiveFilters,
  totalCount,
  pagination,
}: {
  visas: VisaListItem[];
  clients: Client[];
  initialFilters: Partial<VisaFilters>;
  hasActiveFilters: boolean;
  totalCount: number;
  pagination?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Partial<VisaFilters>>(initialFilters);
  const [countryInput, setCountryInput] = useState(initialFilters.country ?? "");
  const [queryInput, setQueryInput] = useState(initialFilters.query ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce on unmount. The parent server component supplies a
  // fresh `key` when initialFilters change, which forces this component to
  // remount — so we never need a "reset local state on initialFilters
  // change" effect here.
  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    };
  }, []);

  function pushFilters(next: Partial<VisaFilters>) {
    const params = new URLSearchParams(searchParams.toString());
    (["q", "status", "client", "country", "page"] as const).forEach((k) =>
      params.delete(k),
    );

    if (next.query) params.set("q", next.query);
    if (next.status?.length) params.set("status", next.status.join(","));
    if (next.clientIds?.length) params.set("client", next.clientIds.join(","));
    if (next.country) params.set("country", next.country);

    const qs = params.toString();
    router.replace(`/dashboard/visas${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function scheduleDebouncedUpdate(next: Partial<VisaFilters>) {
    // Direct access to the debounce ref is safe here because this function
    // is only invoked from event handlers (input onChange), never during
    // render.
    if (debounceRef.current !== null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setFilters(next);
      pushFilters(next);
    }, 300);
  }

  function toggleStatus(status: VisaStatus) {
    const current = new Set(filters.status ?? []);
    if (current.has(status)) current.delete(status);
    else current.add(status);
    const next: Partial<VisaFilters> = {
      ...filters,
      status: current.size ? Array.from(current) : undefined,
    };
    setFilters(next);
    pushFilters(next);
  }

  function setClient(clientId: string) {
    const next: Partial<VisaFilters> = {
      ...filters,
      clientIds: clientId ? [clientId] : undefined,
    };
    setFilters(next);
    pushFilters(next);
  }

  function onQueryChange(value: string) {
    setQueryInput(value);
    scheduleDebouncedUpdate({
      ...filters,
      query: value.trim() ? value.trim() : undefined,
    });
  }

  function onCountryChange(value: string) {
    setCountryInput(value);
    scheduleDebouncedUpdate({
      ...filters,
      country: value.trim() ? value.trim() : undefined,
    });
  }

  function clearQuery() {
    setQueryInput("");
    const next: Partial<VisaFilters> = { ...filters, query: undefined };
    setFilters(next);
    pushFilters(next);
  }

  function clearCountry() {
    setCountryInput("");
    const next: Partial<VisaFilters> = { ...filters, country: undefined };
    setFilters(next);
    pushFilters(next);
  }

  function clearAll() {
    setFilters({});
    setCountryInput("");
    setQueryInput("");
    router.replace("/dashboard/visas", { scroll: false });
  }

  const activeChips: { key: string; label: string; onRemove: () => void }[] = [];
  (filters.status ?? []).forEach((s) => {
    activeChips.push({
      key: `status-${s}`,
      label: `Estado: ${STATUS_META[s].label}`,
      onRemove: () => toggleStatus(s),
    });
  });
  (filters.clientIds ?? []).forEach((cid) => {
    const name = clients.find((c) => c.id === cid)?.name ?? cid;
    activeChips.push({
      key: `client-${cid}`,
      label: `Cliente: ${name}`,
      onRemove: () => setClient(""),
    });
  });
  if (filters.country) {
    activeChips.push({
      key: "country",
      label: `País: ${filters.country}`,
      onRemove: clearCountry,
    });
  }
  if (filters.query) {
    activeChips.push({
      key: "query",
      label: `Búsqueda: ${filters.query}`,
      onRemove: clearQuery,
    });
  }

  return (
    <>
      <section className="mb-5 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface)] p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--operator-border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
              Resumen de visas
            </h2>
            <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">
              Filtra por estado, cliente o país para enfocar tu operación.
            </p>
          </div>
          <p className="text-sm font-semibold text-[var(--operator-brand)]">
            {totalCount} visa{totalCount !== 1 ? "s" : ""} encontrada
            {totalCount !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
              Búsqueda
            </label>
            <input
              type="search"
              value={queryInput}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="País, tipo, notas…"
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
              País
            </label>
            <input
              type="text"
              value={countryInput}
              onChange={(e) => onCountryChange(e.target.value)}
              placeholder="Francia, Japón…"
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
              Cliente
            </label>
            <select
              value={filters.clientIds?.[0] ?? ""}
              onChange={(e) => setClient(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-sm"
            >
              <option value="">Todos los clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
              Estado
            </label>
            <div className="mt-1 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => {
                const isActive = (filters.status ?? []).includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleStatus(s)}
                    aria-pressed={isActive}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                      isActive
                        ? "border-[var(--operator-brand)] bg-[var(--operator-brand)] text-white"
                        : "border-[var(--operator-border)] bg-[var(--operator-surface)] text-[var(--operator-ink-muted)] hover:border-[var(--operator-brand)]"
                    }`}
                  >
                    {STATUS_META[s].label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {hasActiveFilters && activeChips.length > 0 ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--operator-border-subtle)] pt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
              Filtros activos:
            </span>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                className="inline-flex items-center gap-1 rounded-full border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-2.5 py-1 text-xs text-[var(--operator-ink)]"
              >
                {chip.label}
                <span aria-hidden="true" className="text-[var(--operator-ink-subtle)]">
                  ✕
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={clearAll}
              className="ml-auto text-xs font-semibold text-[var(--operator-brand)] hover:underline"
            >
              Limpiar todo
            </button>
          </div>
        ) : null}
      </section>

      <div className="overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--operator-border-subtle)] px-4 py-3">
          <h2 className="text-base font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
            Solicitudes
          </h2>
          <Link
            href="/dashboard/visas/new"
            className="rounded-lg border border-[var(--operator-brand)] bg-[var(--operator-brand)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--operator-brand-strong)]"
          >
            + Nueva visa
          </Link>
        </div>

        {visas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-[var(--operator-ink)]">
              No hay visas que coincidan con los filtros actuales.
            </p>
            <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">
              Ajusta los filtros o crea una nueva solicitud de visa.
            </p>
            <Link
              href="/dashboard/visas/new"
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-semibold text-white"
            >
              + Nueva visa
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--operator-border-subtle)]">
            {visas.map((visa) => (
              <li key={visa.id} className="px-4 py-4 transition hover:bg-[var(--operator-surface-subtle)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/visas/${visa.id}`}
                        className="text-sm font-semibold text-[var(--operator-ink)] hover:text-[var(--operator-brand)]"
                      >
                        {visa.country} — {visa.visaType}
                      </Link>
                      <VisaStatusBadge status={visa.status} />
                    </div>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-[var(--operator-ink-muted)] sm:grid-cols-3">
                      <div>
                        <dt className="inline font-medium">Fecha límite: </dt>
                        <dd className="inline">{formatDate(visa.deadline)}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Precio: </dt>
                        <dd className="inline">{formatPrice(visa.price)}</dd>
                      </div>
                      <div>
                        <dt className="inline font-medium">Actualizado: </dt>
                        <dd className="inline">{formatDate(visa.updatedAt)}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {visa.clients.length === 0 ? (
                      <span className="rounded-full border border-dashed border-[var(--operator-border)] px-2.5 py-1 text-xs text-[var(--operator-ink-subtle)]">
                        Sin clientes asignados
                      </span>
                    ) : (
                      visa.clients.map((c) => (
                        <span
                          key={c.id}
                          className="rounded-full bg-[var(--operator-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--operator-ink)]"
                        >
                          {c.name}
                        </span>
                      ))
                    )}
                    <Link
                      href={`/dashboard/visas/${visa.id}`}
                      className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-xs font-semibold text-[var(--operator-brand)] transition hover:border-[var(--operator-brand)]"
                    >
                      Ver detalle →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {pagination}
    </>
  );
}

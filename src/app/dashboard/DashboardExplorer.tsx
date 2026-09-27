"use client";

import Link from "next/link";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { Client, Tag, TripCurrency, TripFilters, TripStatus } from "@/types";
import { formatAssignedClients, formatDateShort, formatTags } from "@/lib/item-meta";
import { hasActiveTripFilters, normalizeFilterText, tripMatchesFilters } from "@/lib/trip-filters";
import { bulkUpdateTripStatusAction, moveTripStatusAction } from "@/app/dashboard/actions";
import { ExportClientsCsvButton } from "@/components/export-clients-csv-button";
import { TripBoardView } from "@/components/TripBoardView";
import { DashboardFilters } from "./DashboardFilters";

// Debug: capturar stack de warnings de key perdidas durante reconciliación.
// Parche a nivel módulo para atrapar el warn ANTES de que React termine el
// render, porque useEffect es too late (corre post-render).
// TODO: remover cuando se identifique la causa.
(() => {
  const origWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes('a unique "key" prop')
    ) {
      origWarn("[KeyWarning] Missing key. Component stack:");
      origWarn(new Error("key-warning-capture").stack);
    }
    origWarn(...args);
  };
})();

type TripsViewMode = "list" | "board";

const statusMeta: Record<TripStatus, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)]" },
  published: {
    label: "Publicado",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  archived: { label: "Archivado", color: "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-subtle)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-muted)]" },
};

type TripListItem = {
  id: string;
  title: string;
  status: TripStatus;
  startDate: string;
  endDate: string;
  travelerCount: number;
  currency: TripCurrency;
  instructions?: string;
  clients: Client[];
  tags: Tag[];
};

type ClientListItem = Client & { tags: Tag[] };

export function DashboardExplorer({
  trips,
  clients,
  tags,
  allClients,
  initialFilters,
  hasActiveFilters: parentHasFilters,
  tripsPagination,
  clientsPagination,
}: {
  trips: TripListItem[];
  clients: ClientListItem[];
  tags: Tag[];
  allClients: Client[];
  initialFilters: Partial<TripFilters>;
  hasActiveFilters: boolean;
  tripsPagination?: ReactNode;
  clientsPagination?: ReactNode;
}) {
  const [filters, setFilters] = useState<Partial<TripFilters>>(initialFilters);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [viewMode, setViewMode] = useState<TripsViewMode>("list");

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runBulkAction(status: "published" | "archived") {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startTransition(async () => {
      await bulkUpdateTripStatusAction(ids, status);
      setSelected(new Set());
    });
  }

  const normalizedQuery = normalizeFilterText(filters.query?.trim() ?? "");

  const filteredTrips = useMemo(() => {
    if (parentHasFilters) return trips;
    return trips.filter((trip) => tripMatchesFilters(trip, filters));
  }, [trips, filters, parentHasFilters]);

  const filteredClients = useMemo(() => {
    if (!normalizedQuery) return clients;
    return clients.filter((client) => normalizeFilterText(client.name).includes(normalizedQuery));
  }, [clients, normalizedQuery]);

  const hasActiveFilters = parentHasFilters || hasActiveTripFilters(filters);

  return (
    <>
      <DashboardFilters
        onChange={setFilters}
        clients={allClients}
        tags={tags}
      />

      <div className="mb-4 mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setViewMode("list")}
          aria-pressed={viewMode === "list"}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            viewMode === "list"
              ? "bg-[var(--operator-brand)] text-white"
              : "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] hover:bg-[var(--operator-border)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand-strong)]"
          }`}
        >
          Vista de lista
        </button>
        <button
          type="button"
          onClick={() => setViewMode("board")}
          aria-pressed={viewMode === "board"}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            viewMode === "board"
              ? "bg-[var(--operator-brand)] text-white"
              : "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] hover:bg-[var(--operator-border)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand-strong)]"
          }`}
        >
          Vista de tablero
        </button>
      </div>

      {viewMode === "list" && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-4 py-3 dark:border-[var(--operator-border)] dark:bg-[var(--operator-surface-subtle)]">
          <span className="text-sm font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
            {selected.size} viaje{selected.size === 1 ? "" : "s"} seleccionado
            {selected.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runBulkAction("published")}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 dark:bg-green-700 dark:hover:bg-green-600"
          >
            Publicar seleccionados
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runBulkAction("archived")}
            className="rounded-lg bg-[var(--operator-brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50 dark:bg-[var(--operator-surface-subtle)] dark:hover:bg-[var(--operator-brand)]"
          >
            Archivar seleccionados
          </button>
        </div>
      )}

      {viewMode === "list" ? (
        <div className="grid gap-4">
          {filteredTrips.map((trip) => {
            const status = statusMeta[trip.status];
            return (
              <div
                key={trip.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--operator-border)] bg-white p-5 shadow-sm transition hover:shadow-md dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:hover:shadow-none"
              >
                <input
                  type="checkbox"
                  checked={selected.has(trip.id)}
                  onChange={() => toggleSelected(trip.id)}
                  className="h-4 w-4 shrink-0 rounded border-[var(--operator-border)] dark:border-[var(--operator-border)]"
                  aria-label={`Seleccionar ${trip.title}`}
                />
                <Link
                  href={`/dashboard/trips/${trip.id}`}
                  className="flex flex-1 items-center justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{trip.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">{formatAssignedClients(trip.clients)}</p>
                    <p className="text-sm text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">
                      {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                      {" · "}
                      {trip.travelerCount} {trip.travelerCount === 1 ? "viajero" : "viajeros"}
                    </p>
                    {trip.tags.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {formatTags(trip.tags).map((name) => (
                          <li
                            key={name}
                            className="rounded-full bg-[var(--operator-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--operator-brand)] dark:bg-[var(--operator-surface-subtle)] dark:text-[var(--operator-brand)]"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">→</span>
                </Link>
              </div>
            );
          })}
          {filteredTrips.length === 0 && (
            <p className="rounded-xl border border-dashed border-[var(--operator-border)] p-5 text-center text-sm text-[var(--operator-ink-subtle)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-muted)]">
              {hasActiveFilters ? "Ningún viaje coincide con la búsqueda o los filtros." : "Todavía no hay viajes."}
            </p>
          )}
        </div>
      ) : (
        <TripBoardView trips={filteredTrips} onMoveStatus={moveTripStatusAction} />
      )}

      {viewMode === "list" && !hasActiveFilters && tripsPagination}
      {viewMode === "list" && hasActiveFilters && (
        <div className="mt-4 text-center text-sm text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">
          {filteredTrips.length} viaje{filteredTrips.length !== 1 ? "s" : ""} encontrado
          {filteredTrips.length !== 1 ? "s" : ""}
        </div>
      )}

      <div className="mt-10 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Clientes</h2>
        <ExportClientsCsvButton clients={filteredClients} />
      </div>
      <div className="grid gap-3">
        {filteredClients.map((client) => (
          <Link
            key={client.id}
            href={`/dashboard/clients/${client.id}`}
            className="rounded-lg border border-[var(--operator-border)] bg-white p-4 transition hover:shadow-md dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:hover:shadow-none"
          >
            <p className="font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{client.name}</p>
            <p className="text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">{client.email} · {client.phone}</p>
            {client.tags.length > 0 && (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {formatTags(client.tags).map((name) => (
                  <li
                    key={name}
                    className="rounded-full bg-[var(--operator-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--operator-brand)] dark:bg-[var(--operator-surface-subtle)] dark:text-[var(--operator-brand)]"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </Link>
        ))}
        {filteredClients.length === 0 && (
          <p className="rounded-lg border border-dashed border-[var(--operator-border)] p-4 text-center text-sm text-[var(--operator-ink-subtle)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-muted)]">
            Ningún cliente coincide con la búsqueda.
          </p>
        )}
      </div>

      {clientsPagination}
    </>
  );
}

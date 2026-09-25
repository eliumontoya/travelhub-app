"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Client, Tag, TravelAgent, TripCurrency, TripFilters, TripStatus } from "@/types";
import { formatAssignedClients, formatDateShort, formatTags } from "@/lib/item-meta";
import { bulkUpdateTripStatusAction, moveTripStatusAction } from "@/app/dashboard/actions";
import { TripBoardView } from "@/components/TripBoardView";
import { DashboardFilters } from "../DashboardFilters";
import { OperatorButton } from "@/components/ui/OperatorButton";
import { OperatorSurface } from "@/components/ui/OperatorSurface";

type TripsViewMode = "list" | "board";

const statusMeta: Record<TripStatus, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  published: {
    label: "Publicado",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
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
  assignedAgentId?: string;
};

export function TripsExplorer({
  trips,
  clients,
  tags,
  travelAgents,
  initialFilters,
  hasActiveFilters,
  totalCount,
  pagination,
}: {
  trips: TripListItem[];
  clients: Client[];
  tags: Tag[];
  travelAgents?: TravelAgent[];
  initialFilters: Partial<TripFilters>;
  hasActiveFilters: boolean;
  totalCount: number;
  pagination?: ReactNode;
}) {
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

  return (
    <>
      <OperatorSurface as="section" variant="panel" className="mb-5 overflow-hidden p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 border-b border-[var(--operator-border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">Resumen de viajes</h2>
            <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">Usa los filtros para enfocar tu operación.</p>
          </div>
          <p className="text-sm font-semibold text-[var(--operator-brand)]">
            {totalCount} viaje{totalCount !== 1 ? "s" : ""} encontrado{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      <DashboardFilters
        key={JSON.stringify(initialFilters)}
        onChange={() => undefined}
        clients={clients}
        tags={tags}
        travelAgents={travelAgents}
      />
      </OperatorSurface>

      <div className="mb-4 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <OperatorButton
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            variant={viewMode === "list" ? "primary" : "secondary"}
            className="min-h-0 px-3 py-1.5"
          >
            Vista de lista
          </OperatorButton>
          <OperatorButton
            onClick={() => setViewMode("board")}
            aria-pressed={viewMode === "board"}
            variant={viewMode === "board" ? "primary" : "secondary"}
            className="min-h-0 px-3 py-1.5"
          >
            Vista de tablero
          </OperatorButton>
        </div>
        <p className="text-sm text-[var(--operator-ink-muted)]">
          Cambia entre las vistas disponibles
        </p>
      </div>

      {viewMode === "list" && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[var(--operator-radius-card)] border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--operator-brand)]">
            {selected.size} viaje{selected.size === 1 ? "" : "s"} seleccionado
            {selected.size === 1 ? "" : "s"}
          </span>
          <OperatorButton
            disabled={isPending}
            onClick={() => runBulkAction("published")}
            className="min-h-0 px-3 py-1.5"
          >
            Publicar seleccionados
          </OperatorButton>
          <OperatorButton
            disabled={isPending}
            onClick={() => runBulkAction("archived")}
            variant="secondary"
            className="min-h-0 px-3 py-1.5"
          >
            Archivar seleccionados
          </OperatorButton>
        </div>
      )}

      {viewMode === "list" ? (
        <div className="grid gap-4">
          {trips.map((trip) => {
            const status = statusMeta[trip.status];
            return (
              <OperatorSurface
                key={trip.id}
                className="flex items-center gap-3 p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--operator-shadow-panel)]"
              >
                <input
                  type="checkbox"
                  checked={selected.has(trip.id)}
                  onChange={() => toggleSelected(trip.id)}
                  className="h-4 w-4 shrink-0 rounded border-gray-300 dark:border-gray-600"
                  aria-label={`Seleccionar ${trip.title}`}
                />
                <Link
                  href={`/dashboard/trips/${trip.id}`}
                  className="flex flex-1 items-center justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold text-[var(--operator-ink)]">{trip.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">{formatAssignedClients(trip.clients)}</p>
                    <p className="text-sm text-[var(--operator-ink-subtle)]">
                      {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                      {" · "}
                      {trip.travelerCount} {trip.travelerCount === 1 ? "viajero" : "viajeros"}
                      {trip.assignedAgentId && travelAgents && (
                        <>
                          {" · "}
                          <span className="text-[var(--operator-brand)]">
                            {travelAgents.find((a) => a.id === trip.assignedAgentId)?.name ?? "Agente"}
                          </span>
                        </>
                      )}
                    </p>
                    {trip.tags.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {formatTags(trip.tags).map((name) => (
                          <li
                            key={name}
                            className="rounded-full bg-[var(--operator-surface-subtle)] px-2 py-0.5 text-xs font-medium text-[var(--operator-brand)]"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-[var(--operator-ink-subtle)]">→</span>
                </Link>
              </OperatorSurface>
            );
          })}
          {trips.length === 0 && (
            <OperatorSurface as="p" variant="subtle" className="border-dashed p-5 text-center text-sm text-[var(--operator-ink-muted)]">
              {hasActiveFilters ? "Ningún viaje coincide con la búsqueda o los filtros." : "Todavía no hay viajes."}
            </OperatorSurface>
          )}
        </div>
      ) : (
        <TripBoardView trips={trips} travelAgents={travelAgents} onMoveStatus={moveTripStatusAction} />
      )}

      {viewMode === "list" && pagination}
    </>
  );
}

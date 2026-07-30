"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { Client, Tag, TripCurrency, TripFilters, TripStatus } from "@/types";
import { formatAssignedClients, formatDateShort, formatTags } from "@/lib/item-meta";
import { bulkUpdateTripStatusAction, moveTripStatusAction } from "@/app/dashboard/actions";
import { TripBoardView } from "@/components/TripBoardView";
import { DashboardFilters } from "../DashboardFilters";

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
};

export function TripsExplorer({
  trips,
  clients,
  tags,
  initialFilters,
  hasActiveFilters,
  totalCount,
  pagination,
}: {
  trips: TripListItem[];
  clients: Client[];
  tags: Tag[];
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
      <DashboardFilters
        key={JSON.stringify(initialFilters)}
        onChange={() => undefined}
        clients={clients}
        tags={tags}
      />

      <div className="mb-4 mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            }`}
          >
            Vista de tablero
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totalCount} viaje{totalCount !== 1 ? "s" : ""} encontrado{totalCount !== 1 ? "s" : ""}
        </p>
      </div>

      {viewMode === "list" && selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950">
          <span className="text-sm font-medium text-blue-900 dark:text-blue-300">
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
            className="rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:hover:bg-gray-600"
          >
            Archivar seleccionados
          </button>
        </div>
      )}

      {viewMode === "list" ? (
        <div className="grid gap-4">
          {trips.map((trip) => {
            const status = statusMeta[trip.status];
            return (
              <div
                key={trip.id}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:shadow-none"
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
                      <h2 className="font-semibold text-gray-900 dark:text-gray-100">{trip.title}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{formatAssignedClients(trip.clients)}</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500">
                      {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                      {" · "}
                      {trip.travelerCount} {trip.travelerCount === 1 ? "viajero" : "viajeros"}
                    </p>
                    {trip.tags.length > 0 && (
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {formatTags(trip.tags).map((name) => (
                          <li
                            key={name}
                            className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                          >
                            {name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="text-gray-300 dark:text-gray-600">→</span>
                </Link>
              </div>
            );
          })}
          {trips.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400 dark:border-gray-700 dark:text-gray-500">
              {hasActiveFilters ? "Ningún viaje coincide con la búsqueda o los filtros." : "Todavía no hay viajes."}
            </p>
          )}
        </div>
      ) : (
        <TripBoardView trips={trips} onMoveStatus={moveTripStatusAction} />
      )}

      {viewMode === "list" && pagination}
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { bulkUpdateTripStatusAction } from "@/app/dashboard/actions";
import { formatAssignedClients, formatDateShort, formatTags } from "@/lib/item-meta";
import type { Client, Tag, Trip } from "@/types";

const statusMeta = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  published: { label: "Publicado", color: "bg-green-100 text-green-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400" },
};

type TripListItem = Trip & { clients: Client[]; tags: Tag[] };

export function TripListWithBulkActions({ trips }: { trips: TripListItem[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggle(id: string) {
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
    <div>
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-medium text-blue-900">
            {selected.size} viaje{selected.size === 1 ? "" : "s"} seleccionado
            {selected.size === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runBulkAction("published")}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Publicar seleccionados
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => runBulkAction("archived")}
            className="rounded-lg bg-gray-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Archivar seleccionados
          </button>
        </div>
      )}

      <div className="grid gap-4">
        {trips.map((trip) => {
          const status = statusMeta[trip.status];
          return (
            <div
              key={trip.id}
              className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <input
                type="checkbox"
                checked={selected.has(trip.id)}
                onChange={() => toggle(trip.id)}
                className="h-4 w-4 shrink-0 rounded border-gray-300"
                aria-label={`Seleccionar ${trip.title}`}
              />
              <Link
                href={`/dashboard/trips/${trip.id}`}
                className="flex flex-1 items-center justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-900">{trip.title}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{formatAssignedClients(trip.clients)}</p>
                  <p className="text-sm text-gray-400">
                    {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                  </p>
                  {trip.tags.length > 0 && (
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {formatTags(trip.tags).map((name) => (
                        <li
                          key={name}
                          className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <span className="text-gray-300">→</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

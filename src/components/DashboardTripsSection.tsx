"use client";

import { useState } from "react";
import Link from "next/link";
import { Client, Tag, Trip } from "@/types";
import { formatDateShort, formatAssignedClients, formatTags } from "@/lib/item-meta";
import { TripBoardView } from "@/components/TripBoardView";
import { moveTripStatusAction } from "@/app/dashboard/actions";

type TripWithMeta = Trip & { clients: Client[]; tags: Tag[] };

const statusMeta = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  published: { label: "Publicado", color: "bg-green-100 text-green-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400" },
};

type ViewMode = "list" | "board";

// Dueña del toggle lista/tablero del dashboard. La vista de lista conserva el
// markup original de la página; la vista de tablero delega en TripBoardView
// (mover estado vía botones, no drag-and-drop, ver ReorderButtons.tsx).
export function DashboardTripsSection({ trips }: { trips: TripWithMeta[] }) {
  const [view, setView] = useState<ViewMode>("list");

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setView("list")}
          aria-pressed={view === "list"}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            view === "list" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Vista de lista
        </button>
        <button
          type="button"
          onClick={() => setView("board")}
          aria-pressed={view === "board"}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            view === "board" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Vista de tablero
        </button>
      </div>

      {view === "list" ? (
        <div className="grid gap-4">
          {trips.map((trip) => {
            const status = statusMeta[trip.status];
            return (
              <Link
                key={trip.id}
                href={`/dashboard/trips/${trip.id}`}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
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
            );
          })}
        </div>
      ) : (
        <TripBoardView trips={trips} onMoveStatus={moveTripStatusAction} />
      )}
    </div>
  );
}

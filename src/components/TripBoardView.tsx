"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Client, Tag, TripStatus } from "@/types";
import { formatDateShort, formatAssignedClients, formatTags } from "@/lib/item-meta";

type TripWithMeta = {
  id: string;
  title: string;
  status: TripStatus;
  startDate: string;
  endDate: string;
  clients: Client[];
  tags: Tag[];
};

const statusMeta: Record<TripStatus, { label: string; color: string }> = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  published: {
    label: "Publicado",
    color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
};

const columns: TripStatus[] = ["draft", "published", "archived"];

export function TripBoardView({
  trips,
  onMoveStatus,
}: {
  trips: TripWithMeta[];
  onMoveStatus: (tripId: string, status: TripStatus) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {columns.map((status) => {
        const columnTrips = trips.filter((trip) => trip.status === status);
        return (
          <div key={status} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{statusMeta[status].label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500 shadow-sm dark:bg-gray-800 dark:text-gray-400">
                {columnTrips.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {columnTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} onMoveStatus={onMoveStatus} />
              ))}
              {columnTrips.length === 0 && (
                <p className="rounded-lg border border-dashed border-gray-200 p-3 text-center text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                  Sin viajes
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TripCard({
  trip,
  onMoveStatus,
}: {
  trip: TripWithMeta;
  onMoveStatus: (tripId: string, status: TripStatus) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const otherStatuses = columns.filter((status) => status !== trip.status);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <Link href={`/dashboard/trips/${trip.id}`} className="block hover:underline">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">{trip.title}</h4>
      </Link>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{formatAssignedClients(trip.clients)}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
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
      <div className="mt-2 flex flex-wrap gap-1.5">
        {otherStatuses.map((status) => (
          <button
            key={status}
            type="button"
            disabled={isPending}
            onClick={() => startTransition(() => onMoveStatus(trip.id, status))}
            className="rounded-full border border-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Mover a {statusMeta[status].label}
          </button>
        ))}
      </div>
    </div>
  );
}

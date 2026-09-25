"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Client, Tag, TravelAgent, TripStatus } from "@/types";
import { formatDateShort, formatAssignedClients, formatTags } from "@/lib/item-meta";

type TripWithMeta = {
  id: string;
  title: string;
  status: TripStatus;
  startDate: string;
  endDate: string;
  clients: Client[];
  tags: Tag[];
  assignedAgentId?: string;
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
  travelAgents,
  onMoveStatus,
}: {
  trips: TripWithMeta[];
  travelAgents?: TravelAgent[];
  onMoveStatus: (tripId: string, status: TripStatus) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {columns.map((status) => {
        const columnTrips = trips.filter((trip) => trip.status === status);
        return (
          <div key={status} className="rounded-2xl bg-[#f8f1f4] p-3 dark:bg-[#2a1823]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#5a173c] dark:text-[#ffe6f0]">{statusMeta[status].label}</h3>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-[#79596a] shadow-[0_3px_8px_rgba(74,9,47,0.08)] dark:bg-[#442438] dark:text-[#f0dbe5]">
                {columnTrips.length}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {columnTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} travelAgents={travelAgents} onMoveStatus={onMoveStatus} />
              ))}
              {columnTrips.length === 0 && (
                <p className="rounded-xl border border-dashed border-[#d8c1cc] p-3 text-center text-xs text-[#947587] dark:border-[#634357] dark:text-[#cbaebb]">
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
  travelAgents,
  onMoveStatus,
}: {
  trip: TripWithMeta;
  travelAgents?: TravelAgent[];
  onMoveStatus: (tripId: string, status: TripStatus) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const otherStatuses = columns.filter((status) => status !== trip.status);

  return (
    <div className="rounded-xl border border-[#eadde3] bg-white p-3 shadow-[0_7px_16px_rgba(74,9,47,0.06)] dark:border-[#573044] dark:bg-[#2d1725]">
      <Link href={`/dashboard/trips/${trip.id}`} className="block hover:underline">
        <h4 className="font-semibold text-[#40142c] dark:text-[#fff0f6]">{trip.title}</h4>
      </Link>
      <p className="mt-1 text-xs text-[#76596a] dark:text-[#dac4d0]">{formatAssignedClients(trip.clients)}</p>
      <p className="text-xs text-[#967888] dark:text-[#c9adb9]">
        {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
        {trip.assignedAgentId && travelAgents && (
          <>
            {" · "}
            <span className="text-[#8b2356] dark:text-[#ffd983]">
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
              className="rounded-full bg-[#f8e8ef] px-2 py-0.5 text-xs font-medium text-[#791b4b] dark:bg-[#54243d] dark:text-[#ffd8a4]"
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
            className="rounded-full border border-[#d9c5cf] px-2 py-0.5 text-xs font-medium text-[#664658] hover:border-[#b87b97] hover:bg-[#fff4f8] disabled:opacity-40 dark:border-[#654154] dark:text-[#ead5df] dark:hover:bg-[#432237]"
          >
            Mover a {statusMeta[status].label}
          </button>
        ))}
      </div>
    </div>
  );
}

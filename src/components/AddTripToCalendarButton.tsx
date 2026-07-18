"use client";

import { TripWithDetails } from "@/types";
import { buildIcsForTrip, downloadIcs } from "@/lib/ics";

export function AddTripToCalendarButton({ trip }: { trip: TripWithDetails }) {
  return (
    <button
      onClick={() => downloadIcs(buildIcsForTrip(trip), `${trip.slug}.ics`)}
      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      📅 Agregar viaje completo a mi calendario
    </button>
  );
}

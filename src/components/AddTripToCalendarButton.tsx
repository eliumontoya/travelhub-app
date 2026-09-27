"use client";

import { TripWithDetails } from "@/types";
import { buildIcsForTrip, downloadIcs } from "@/lib/ics";
import { DEFAULT_LANG, Lang, dictionary } from "@/lib/i18n";

export function AddTripToCalendarButton({
  trip,
  lang = DEFAULT_LANG,
}: {
  trip: TripWithDetails;
  lang?: Lang;
}) {
  return (
    <button
      onClick={() => downloadIcs(buildIcsForTrip(trip), `${trip.slug}.ics`)}
      className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)]"
    >
      {dictionary[lang].addTripToCalendar}
    </button>
  );
}

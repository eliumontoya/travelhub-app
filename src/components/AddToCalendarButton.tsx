"use client";

import { Item } from "@/types";
import { buildIcsForItem, downloadIcs } from "@/lib/ics";

export function AddToCalendarButton({ item, date }: { item: Item; date: string }) {
  return (
    <button
      onClick={() => downloadIcs(buildIcsForItem(item, date), `${item.title}.ics`)}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
    >
      + Calendario
    </button>
  );
}

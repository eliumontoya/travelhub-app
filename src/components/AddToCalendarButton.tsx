"use client";

import { Item } from "@/types";
import { buildIcsForItem, downloadIcs } from "@/lib/ics";
import { DEFAULT_LANG, Lang, dictionary } from "@/lib/i18n";

export function AddToCalendarButton({
  item,
  date,
  lang = DEFAULT_LANG,
}: {
  item: Item;
  date: string;
  lang?: Lang;
}) {
  return (
    <button
      onClick={() => downloadIcs(buildIcsForItem(item, date), `${item.title}.ics`)}
      className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
    >
      {dictionary[lang].calendarButton}
    </button>
  );
}

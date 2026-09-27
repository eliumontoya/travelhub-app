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
      className="rounded-md border border-[var(--operator-border)] px-2 py-1 text-xs text-[var(--operator-ink-muted)] hover:bg-[var(--operator-canvas)]"
    >
      {dictionary[lang].calendarButton}
    </button>
  );
}

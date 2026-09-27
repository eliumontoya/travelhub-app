import type { ReactNode } from "react";
import type { ItemType } from "@/types";

const toneByType: Record<ItemType, string> = {
  flight: "bg-[#ffe8e6] text-[var(--operator-coral)]",
  hotel: "bg-[#f5e4f7] text-[var(--operator-brand)]",
  activity: "bg-[#fff4d9] text-[#b76700]",
  restaurant: "bg-[#fff0e8] text-[#b76700]",
  transport: "bg-[#eaf5ef] text-[var(--operator-brand)]",
  note: "bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]",
};

function FlightGlyph() {
  return (
    <path d="M4.5 13.7 19 6.2c.9-.5 1.9.4 1.5 1.4l-1.2 2.9a2 2 0 0 1-1 .9l-4.1 1.5 1.7 5.1-1.9 1-3.2-4.6-3.5 1.3-.4 2.2-1.6.7-.8-3.2-2.7-1.9 1.2-1.1 2 .8Z" />
  );
}

function HotelGlyph() {
  return (
    <>
      <path d="M4.5 6.4v11.2" />
      <path d="M4.5 12.2h15v5.4" />
      <path d="M8 12.2V9.7c0-1.1.8-1.9 1.9-1.9h2.7c1.1 0 1.9.8 1.9 1.9v2.5" />
      <path d="M19.5 17.6H4.5" />
    </>
  );
}

function RestaurantGlyph() {
  return (
    <>
      <path d="M7.2 5.2v6.2" />
      <path d="M4.9 5.2v6.2" />
      <path d="M9.5 5.2v6.2" />
      <path d="M4.9 11.4h4.6" />
      <path d="M7.2 11.4v7.4" />
      <path d="M16.6 5.2c1.5 1.5 2.3 3.3 2.3 5.4v.9h-3.7" />
      <path d="M15.2 5.2v13.6" />
    </>
  );
}

function ActivityGlyph() {
  return (
    <>
      <path d="M8.2 10.2 10 6.6h4l1.8 3.6" />
      <circle cx="7.1" cy="13.6" r="3.1" />
      <circle cx="16.9" cy="13.6" r="3.1" />
      <path d="M10.2 13.6h3.6" />
      <path d="M12 6.6v7" />
    </>
  );
}

function TransportGlyph() {
  return (
    <>
      <path d="M5.2 15.7h13.6l-.9-5.2a2.6 2.6 0 0 0-2.6-2.2H8.7a2.6 2.6 0 0 0-2.6 2.2l-.9 5.2Z" />
      <path d="M7.1 12h9.8" />
      <circle cx="8.2" cy="17" r="1.2" />
      <circle cx="15.8" cy="17" r="1.2" />
    </>
  );
}

function NoteGlyph() {
  return (
    <>
      <path d="M7 4.8h7.3L18 8.5v10.7H7z" />
      <path d="M14.3 4.8v3.7H18" />
      <path d="M9.4 12h5.2" />
      <path d="M9.4 15h5.2" />
    </>
  );
}

const glyphByType: Record<ItemType, () => ReactNode> = {
  flight: FlightGlyph,
  hotel: HotelGlyph,
  activity: ActivityGlyph,
  restaurant: RestaurantGlyph,
  transport: TransportGlyph,
  note: NoteGlyph,
};

export function ItemTypeIcon({ type, className = "", title }: { type: ItemType; className?: string; title?: string }) {
  const Glyph = glyphByType[type];
  return (
    <span
      className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${toneByType[type]} ${className}`}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill={type === "flight" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <Glyph />
      </svg>
    </span>
  );
}

export function CalendarGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4.5v3" />
      <path d="M17 4.5v3" />
      <path d="M5.2 7h13.6a1.8 1.8 0 0 1 1.8 1.8v9.4a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V8.8A1.8 1.8 0 0 1 5.2 7Z" />
      <path d="M3.4 11h17.2" />
      <path d="M8 14h.1" />
      <path d="M12 14h.1" />
      <path d="M16 14h.1" />
    </svg>
  );
}

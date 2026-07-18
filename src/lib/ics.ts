import { Item, TripWithDetails } from "@/types";

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function toIcsDate(date: string, time?: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = (time ?? "09:00").split(":").map(Number);
  return `${y}${pad(m)}${pad(d)}T${pad(h)}${pad(min)}00`;
}

function escapeText(text: string) {
  return text.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}

function buildEvent(item: Item, date: string) {
  const start = toIcsDate(date, item.startTime);
  const end = item.endTime
    ? toIcsDate(date, item.endTime)
    : toIcsDate(date, item.startTime ? addHour(item.startTime) : "10:00");

  const lines = [
    "BEGIN:VEVENT",
    `UID:${item.id}@travelhub`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeText(item.title)}`,
  ];
  if (item.location) lines.push(`LOCATION:${escapeText(item.location)}`);
  const descParts = [];
  if (item.confirmationCode) descParts.push(`Confirmación: ${item.confirmationCode}`);
  if (item.notes) descParts.push(item.notes);
  if (descParts.length) lines.push(`DESCRIPTION:${escapeText(descParts.join(" - "))}`);
  lines.push("END:VEVENT");
  return lines.join("\r\n");
}

function addHour(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${pad((h + 1) % 24)}:${pad(m)}`;
}

export function buildIcsForItem(item: Item, date: string): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TravelHub//ES",
    buildEvent(item, date),
    "END:VCALENDAR",
  ].join("\r\n");
}

export function buildIcsForTrip(trip: TripWithDetails): string {
  const events = trip.days.flatMap((day) =>
    day.items.map((item) => buildEvent(item, day.date))
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TravelHub//ES",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

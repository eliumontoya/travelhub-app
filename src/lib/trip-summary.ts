import { TripWithDetails } from "@/types";
import { formatDateLong, itemTypeMeta } from "@/lib/item-meta";

export function buildTripSummary(trip: TripWithDetails, publicUrl: string): string {
  const lines: string[] = [];

  lines.push(trip.title);
  lines.push(`${formatDateLong(trip.startDate)} - ${formatDateLong(trip.endDate)}`);
  lines.push("");

  for (const day of trip.days) {
    lines.push(`${formatDateLong(day.date)}:`);
    if (day.items.length === 0) {
      lines.push("  (sin actividades)");
    }
    for (const item of day.items) {
      const meta = itemTypeMeta[item.type];
      const time = item.startTime ? `${item.startTime} ` : "";
      lines.push(`  - ${time}${meta.icon} ${meta.label}: ${item.title}`);
    }
    lines.push("");
  }

  lines.push(`Ver itinerario completo: ${publicUrl}`);

  return lines.join("\n");
}

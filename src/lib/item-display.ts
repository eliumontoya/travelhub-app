import type { Item } from "@/types";

export function getItemFlightNumber(item: Item): string | null {
  if (item.type !== "flight" || !item.metadata) return null;
  return item.metadata.flightNumber || null;
}

export function formatItemMetadataSummary(item: Item): string | null {
  if (!item.metadata) return null;

  switch (item.type) {
    case "flight": {
      const route = item.metadata.departureAirport && item.metadata.arrivalAirport
        ? ` · ${item.metadata.departureAirport} → ${item.metadata.arrivalAirport}`
        : "";
      return `${item.metadata.airline} ${item.metadata.flightNumber}${route}`;
    }
    case "hotel":
      return [item.metadata.roomType, item.metadata.boardBasis].filter(Boolean).join(" · ") || null;
    case "activity":
      return [item.metadata.provider, item.metadata.duration].filter(Boolean).join(" · ") || null;
    case "restaurant":
      return item.metadata.cuisine || null;
    case "transport":
      return [item.metadata.company, item.metadata.vehicleType].filter(Boolean).join(" · ") || null;
  }
}

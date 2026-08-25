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


type DetailRow = { label: string; value: string };

const detailLabels: Record<string, string> = {
  airline: "Aerolínea",
  flightNumber: "Vuelo",
  departureAirport: "Salida",
  arrivalAirport: "Llegada",
  departureTime: "Hora de salida",
  arrivalTime: "Hora de llegada",
  terminal: "Terminal",
  gate: "Puerta",
  seat: "Asiento",
  bookingReference: "Referencia de reserva",
  hotelName: "Hotel",
  address: "Dirección",
  checkIn: "Check-in",
  checkOut: "Check-out",
  roomType: "Habitación",
  boardBasis: "Régimen",
  hotelPhone: "Teléfono",
  specialRequests: "Solicitudes especiales",
  activityName: "Actividad",
  provider: "Proveedor",
  startTime: "Inicio",
  endTime: "Fin",
  duration: "Duración",
  ticketType: "Tipo de boleto",
  includes: "Incluye",
  meetingPoint: "Punto de encuentro",
  restaurantName: "Restaurante",
  cuisine: "Cocina",
  dressCode: "Código de vestimenta",
  reservationReference: "Referencia de reserva",
  phone: "Teléfono",
  company: "Empresa",
  pickupLocation: "Recogida",
  dropoffLocation: "Destino",
  pickupTime: "Hora de recogida",
  vehicleType: "Vehículo",
  driverName: "Chofer",
  driverPhone: "Teléfono del chofer",
};

const detailOrder: Record<Item["type"], string[]> = {
  flight: ["airline", "flightNumber", "departureAirport", "arrivalAirport", "departureTime", "arrivalTime", "terminal", "gate", "seat", "bookingReference"],
  hotel: ["hotelName", "address", "checkIn", "checkOut", "roomType", "boardBasis", "bookingReference", "hotelPhone", "specialRequests"],
  activity: ["activityName", "provider", "address", "startTime", "endTime", "duration", "ticketType", "bookingReference", "includes", "meetingPoint"],
  restaurant: ["restaurantName", "address", "cuisine", "dressCode", "reservationReference", "phone"],
  transport: ["company", "pickupLocation", "dropoffLocation", "pickupTime", "vehicleType", "driverName", "driverPhone", "bookingReference"],
  note: [],
};

export function formatItemDetailRows(item: Item): DetailRow[] {
  if (!item.metadata) return [];
  const metadata = item.metadata as unknown as Record<string, unknown>;
  return detailOrder[item.type]
    .map((key) => {
      const value = metadata[key];
      return typeof value === "string" && value.trim()
        ? { label: detailLabels[key] ?? key, value: value.trim() }
        : null;
    })
    .filter((row): row is DetailRow => Boolean(row));
}

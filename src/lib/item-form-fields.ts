import { Item, ItemType } from "@/types";

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "time" | "date" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
};

export const metadataFieldsByType: Record<ItemType, FieldDef[]> = {
  flight: [
    { name: "airline", required: true, label: "Aerolínea", type: "text" },
    { name: "flightNumber", required: true, label: "Número de vuelo", type: "text" },
    { name: "departureAirport", required: true, label: "Aeropuerto de salida", type: "text" },
    { name: "arrivalAirport", required: true, label: "Aeropuerto de llegada", type: "text" },
    { name: "departureTime", required: true, label: "Hora de salida", type: "time" },
    { name: "arrivalTime", required: true, label: "Hora de llegada", type: "time" },
    { name: "terminal", label: "Terminal", type: "text" },
    { name: "gate", label: "Puerta", type: "text" },
    { name: "seat", label: "Asiento", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
  ],
  hotel: [
    { name: "hotelName", required: true, label: "Nombre del hotel", type: "text" },
    { name: "address", required: true, label: "Dirección", type: "text" },
    { name: "checkIn", required: true, label: "Check-in", type: "date" },
    { name: "checkOut", required: true, label: "Check-out", type: "date" },
    { name: "roomType", required: true, label: "Tipo de habitación", type: "text" },
    {
      name: "boardBasis",
      required: true,
      label: "Régimen",
      type: "select",
      options: [
        { value: "Solo alojamiento", label: "Solo alojamiento" },
        { value: "Desayuno incluido", label: "Desayuno incluido" },
        { value: "Media pensión", label: "Media pensión" },
        { value: "Pensión completa", label: "Pensión completa" },
        { value: "Todo incluido", label: "Todo incluido" },
      ],
    },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
    { name: "hotelPhone", label: "Teléfono del hotel", type: "text" },
    { name: "specialRequests", label: "Solicitudes especiales", type: "textarea" },
  ],
  activity: [
    { name: "activityName", required: true, label: "Nombre de la actividad", type: "text" },
    { name: "provider", required: true, label: "Proveedor", type: "text" },
    { name: "address", required: true, label: "Dirección", type: "text" },
    { name: "startTime", required: true, label: "Hora de inicio", type: "time" },
    { name: "endTime", required: true, label: "Hora de fin", type: "time" },
    { name: "duration", label: "Duración", type: "text" },
    { name: "ticketType", label: "Tipo de entrada", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
    { name: "includes", label: "Incluye", type: "text" },
    { name: "meetingPoint", label: "Punto de encuentro", type: "text" },
  ],
  restaurant: [
    { name: "restaurantName", required: true, label: "Nombre del restaurante", type: "text" },
    { name: "address", required: true, label: "Dirección", type: "text" },
    { name: "cuisine", required: true, label: "Tipo de cocina", type: "text" },
    { name: "dressCode", label: "Código de vestimenta", type: "text" },
    { name: "reservationReference", label: "Referencia de reserva", type: "text" },
    { name: "phone", label: "Teléfono", type: "text" },
  ],
  transport: [
    { name: "company", required: true, label: "Empresa", type: "text" },
    { name: "pickupLocation", required: true, label: "Lugar de recogida", type: "text" },
    { name: "dropoffLocation", required: true, label: "Lugar de destino", type: "text" },
    { name: "pickupTime", required: true, label: "Hora de recogida", type: "text" },
    { name: "vehicleType", label: "Tipo de vehículo", type: "text" },
    { name: "driverName", label: "Nombre del conductor", type: "text" },
    { name: "driverPhone", label: "Teléfono del conductor", type: "text" },
    { name: "bookingReference", label: "Referencia de reserva", type: "text" },
  ],
  note: [],
};

export function appendSerializedMetadata(formData: FormData, selectedType: ItemType) {
  const mFields = metadataFieldsByType[selectedType];
  const metadataValues: Record<string, string> = {};

  for (const field of mFields) {
    const val = String(formData.get(`metadata_${field.name}`) ?? "").trim();
    if (val) metadataValues[field.name] = val;
    formData.delete(`metadata_${field.name}`);
  }

  formData.set("metadata", JSON.stringify(Object.keys(metadataValues).length ? metadataValues : null));
}

export function metadataDefaultValue(item: Item | undefined, fieldName: string): string | undefined {
  if (!item?.metadata) return undefined;
  const m = item.metadata as unknown as Record<string, unknown> | null;
  if (!m) return undefined;
  const val = m[fieldName];
  return typeof val === "string" ? val : undefined;
}

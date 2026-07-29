import { z } from "zod";
import { ItemType } from "@/types";

export const flightMetadataSchema = z.object({
  airline: z.string().min(1, "Aerolínea requerida"),
  flightNumber: z.string().min(1, "Número de vuelo requerido"),
  departureAirport: z.string().min(1, "Aeropuerto de salida requerido"),
  arrivalAirport: z.string().min(1, "Aeropuerto de llegada requerido"),
  departureTime: z.string().min(1, "Hora de salida requerida"),
  arrivalTime: z.string().min(1, "Hora de llegada requerida"),
  terminal: z.string().optional(),
  gate: z.string().optional(),
  seat: z.string().optional(),
  bookingReference: z.string().optional(),
});

export const hotelMetadataSchema = z.object({
  hotelName: z.string().min(1, "Nombre del hotel requerido"),
  address: z.string().min(1, "Dirección requerida"),
  checkIn: z.string().min(1, "Check-in requerido"),
  checkOut: z.string().min(1, "Check-out requerido"),
  roomType: z.string().min(1, "Tipo de habitación requerido"),
  boardBasis: z.string().min(1, "Régimen requerido"),
  bookingReference: z.string().optional(),
  hotelPhone: z.string().optional(),
  specialRequests: z.string().optional(),
});

export const activityMetadataSchema = z.object({
  activityName: z.string().min(1, "Nombre de la actividad requerido"),
  provider: z.string().min(1, "Proveedor requerido"),
  address: z.string().min(1, "Dirección requerida"),
  startTime: z.string().min(1, "Hora de inicio requerida"),
  endTime: z.string().min(1, "Hora de fin requerida"),
  duration: z.string().optional(),
  ticketType: z.string().optional(),
  bookingReference: z.string().optional(),
  includes: z.string().optional(),
  meetingPoint: z.string().optional(),
});

export const restaurantMetadataSchema = z.object({
  restaurantName: z.string().min(1, "Nombre del restaurante requerido"),
  address: z.string().min(1, "Dirección requerida"),
  cuisine: z.string().min(1, "Tipo de cocina requerido"),
  dressCode: z.string().optional(),
  reservationReference: z.string().optional(),
  phone: z.string().optional(),
});

export const transportMetadataSchema = z.object({
  company: z.string().min(1, "Empresa requerida"),
  pickupLocation: z.string().min(1, "Lugar de recogida requerido"),
  dropoffLocation: z.string().min(1, "Lugar de destino requerido"),
  pickupTime: z.string().min(1, "Hora de recogida requerida"),
  vehicleType: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  bookingReference: z.string().optional(),
});

const metadataSchemas: Record<ItemType, z.ZodTypeAny> = {
  flight: flightMetadataSchema,
  hotel: hotelMetadataSchema,
  activity: activityMetadataSchema,
  restaurant: restaurantMetadataSchema,
  transport: transportMetadataSchema,
  note: z.null(),
};

/**
 * Validates metadata against the schema for the given item type.
 * Returns the validated object (with all fields) or null for note type.
 * Throws a ZodError if validation fails.
 */
export function validateItemMetadata(type: ItemType, data: unknown): Record<string, unknown> | null {
  if (type === "note" || data === null || data === undefined) return null;
  const schema = metadataSchemas[type];
  return schema.parse(data) as Record<string, unknown>;
}

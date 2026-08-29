import { z } from "zod";
import { ItemType } from "@/types";

export const flightMetadataSchema = z.object({
  airline: z.string().min(1).optional(),
  flightNumber: z.string().min(1).optional(),
  departureAirport: z.string().min(1).optional(),
  arrivalAirport: z.string().min(1).optional(),
  departureTime: z.string().min(1).optional(),
  arrivalTime: z.string().min(1).optional(),
  terminal: z.string().min(1).optional(),
  gate: z.string().min(1).optional(),
  seat: z.string().min(1).optional(),
  bookingReference: z.string().min(1).optional(),
});

export const hotelMetadataSchema = z.object({
  hotelName: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  checkIn: z.string().min(1).optional(),
  checkOut: z.string().min(1).optional(),
  roomType: z.string().min(1).optional(),
  boardBasis: z.string().min(1).optional(),
  bookingReference: z.string().min(1).optional(),
  hotelPhone: z.string().min(1).optional(),
  specialRequests: z.string().min(1).optional(),
});

export const activityMetadataSchema = z.object({
  activityName: z.string().min(1).optional(),
  provider: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
  duration: z.string().min(1).optional(),
  ticketType: z.string().min(1).optional(),
  bookingReference: z.string().min(1).optional(),
  includes: z.string().min(1).optional(),
  meetingPoint: z.string().min(1).optional(),
});

export const restaurantMetadataSchema = z.object({
  restaurantName: z.string().min(1).optional(),
  address: z.string().min(1).optional(),
  cuisine: z.string().min(1).optional(),
  dressCode: z.string().min(1).optional(),
  reservationReference: z.string().min(1).optional(),
  phone: z.string().min(1).optional(),
});

export const transportMetadataSchema = z.object({
  company: z.string().min(1).optional(),
  pickupLocation: z.string().min(1).optional(),
  dropoffLocation: z.string().min(1).optional(),
  pickupTime: z.string().min(1).optional(),
  vehicleType: z.string().min(1).optional(),
  driverName: z.string().min(1).optional(),
  driverPhone: z.string().min(1).optional(),
  bookingReference: z.string().min(1).optional(),
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
 * Returns the validated object with the provided non-empty fields, or null for note/blank metadata.
 * Throws a ZodError if metadata has an invalid shape.
 */
export function validateItemMetadata(type: ItemType, data: unknown): Record<string, unknown> | null {
  if (type === "note" || data === null || data === undefined) return null;
  const schema = metadataSchemas[type];
  return schema.parse(data) as Record<string, unknown>;
}

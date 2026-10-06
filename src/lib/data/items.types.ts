import type { Supplier } from "@/lib/data/suppliers.types";

export type ItemType =
  | "flight"
  | "hotel"
  | "activity"
  | "restaurant"
  | "transport"
  | "note";

export interface ItemDocument {
  id: string;
  itemId: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  uploadedAt: string;
  url?: string | null;
}

// ---------- Metadata discriminated union per ItemType ----------

export interface FlightMetadata {
  airline: string;
  flightNumber: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  terminal?: string;
  gate?: string;
  seat?: string;
  bookingReference?: string;
}

export interface HotelMetadata {
  hotelName: string;
  address: string;
  checkIn: string;
  checkOut: string;
  roomType: string;
  boardBasis: string;
  bookingReference?: string;
  hotelPhone?: string;
  specialRequests?: string;
}

interface ActivityMetadata {
  activityName: string;
  provider: string;
  address: string;
  startTime: string;
  endTime: string;
  duration?: string;
  ticketType?: string;
  bookingReference?: string;
  includes?: string;
  meetingPoint?: string;
}

interface RestaurantMetadata {
  restaurantName: string;
  address: string;
  cuisine: string;
  dressCode?: string;
  reservationReference?: string;
  phone?: string;
}

interface TransportMetadata {
  company: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  bookingReference?: string;
}

type BaseItem = {
  id: string;
  tripDayId: string;
  createdByClientId: string | null;
  title: string;
  startTime?: string;
  endTime?: string;
  location?: string;
  lat?: number;
  lng?: number;
  confirmationCode?: string;
  notes?: string;
  cost?: number;
  sortOrder: number;
  documents?: ItemDocument[];
  deletedAt?: string;
  supplierId?: string;
};

type FlightItem = BaseItem & { type: "flight"; metadata: FlightMetadata | null };
type HotelItem = BaseItem & { type: "hotel"; metadata: HotelMetadata | null };
type ActivityItem = BaseItem & { type: "activity"; metadata: ActivityMetadata | null };
type RestaurantItem = BaseItem & { type: "restaurant"; metadata: RestaurantMetadata | null };
type TransportItem = BaseItem & { type: "transport"; metadata: TransportMetadata | null };
type NoteItem = BaseItem & { type: "note"; metadata: null };

export type Item =
  | FlightItem
  | HotelItem
  | ActivityItem
  | RestaurantItem
  | TransportItem
  | NoteItem;

export type ItemWithSupplier = Item & {
  supplier?: Pick<Supplier, "name" | "address" | "lat" | "lng">;
};

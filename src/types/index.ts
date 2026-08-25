export type ItemType =
  | "flight"
  | "hotel"
  | "activity"
  | "restaurant"
  | "transport"
  | "note";

export type TripStatus = "draft" | "published" | "archived";

export type TripCurrency = "MXN" | "USD" | "EUR";

export type TripFilters = {
  query?: string;
  status?: TripStatus[];
  dateFrom?: string;
  dateTo?: string;
  clientIds?: string[];
  tagIds?: string[];
  currency?: TripCurrency;
};

export interface Client {
  id: string;
  name: string;
  /** Slug público para /c/{slug} (historial de viajes publicados). Nullable: solo se genera para clientes nuevos, sin backfill. */
  slug?: string;
  email: string;
  phone: string;
  notes?: string;
  referralSource?: string | null;
  birthDate?: string;
  /** Portada del perfil del cliente (vista pública /c/[slug]). Opcional. */
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

export interface Trip {
  id: string;
  clientId: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  instructions?: string;
  /**
   * Notas privadas para uso interno de agentes (Tritones). NUNCA se cargan
   * en getTrips/getTripWithDetails/rowToTrip ni en TripWithDetails: se leen
   * y escriben exclusivamente vía getTripInternalNotes/updateTripInternalNotes
   * en src/lib/data.ts, usadas solo por el editor de dashboard. Este campo
   * jamás debe llegar a /t/[slug].
   */
  internalNotes?: string;
  travelerCount: number;
  budget?: number;
  status: TripStatus;
  currency: TripCurrency;
  /** Viajes plantilla (issue #31) no tienen cliente y se excluyen de los listados normales. */
  isTemplate: boolean;
  /** Opt-in del agente Triton: si true, la vista pública muestra el resumen de costos. */
  showCostsToClient: boolean;
  createdAt: string;
  updatedAt: string;
  /** Timestamp del envío del recordatorio automático por email; undefined = aún no enviado. */
  reminderSentAt?: string;
  /** Solo agente: nunca se selecciona ni se envía a la vista pública /t/[slug]. */
  salePrice?: number;
  /** Solo agente: nunca se selecciona ni se envía a la vista pública /t/[slug]. */
  commissionRate?: number;
}

export interface TripStatusHistoryEntry {
  id: string;
  tripId: string;
  fromStatus: TripStatus | null;
  toStatus: TripStatus;
  changedAt: string;
}

export interface TripDay {
  id: string;
  tripId: string;
  date: string;
  notes?: string;
  sortOrder: number;
  deletedAt?: string;
}

export interface ItemDocument {
  id: string;
  itemId: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  uploadedAt: string;
  url?: string | null;
}

export interface ClientDocument {
  id: string;
  clientId: string;
  filePath: string;
  filename: string;
  mimeType?: string;
  createdAt: string;
}

export interface TripPhoto {
  id: string;
  tripId: string;
  filePath: string;
  fileName: string;
  sortOrder: number;
  createdAt: string;
}

export interface TripDocument {
  id: string;
  tripId: string;
  filePath: string;
  filename: string;
  mimeType?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  type: string;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  address?: string;
  lat?: number;
  lng?: number;
  notes?: string;
  tags: string[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
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

export interface ActivityMetadata {
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

export interface RestaurantMetadata {
  restaurantName: string;
  address: string;
  cuisine: string;
  dressCode?: string;
  reservationReference?: string;
  phone?: string;
}

export interface TransportMetadata {
  company: string;
  pickupLocation: string;
  dropoffLocation: string;
  pickupTime: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
  bookingReference?: string;
}

export type ItemMetadata =
  | FlightMetadata
  | HotelMetadata
  | ActivityMetadata
  | RestaurantMetadata
  | TransportMetadata
  | null;

type BaseItem = {
  id: string;
  tripDayId: string;
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

export type FlightItem = BaseItem & { type: "flight"; metadata: FlightMetadata | null };
export type HotelItem = BaseItem & { type: "hotel"; metadata: HotelMetadata | null };
export type ActivityItem = BaseItem & { type: "activity"; metadata: ActivityMetadata | null };
export type RestaurantItem = BaseItem & { type: "restaurant"; metadata: RestaurantMetadata | null };
export type TransportItem = BaseItem & { type: "transport"; metadata: TransportMetadata | null };
export type NoteItem = BaseItem & { type: "note"; metadata: null };

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

export interface PackingItem {
  id: string;
  tripId: string;
  label: string;
  checked: boolean;
  sortOrder: number;
}

export interface TripWithDetails extends Trip {
  /** Fuente de verdad: todos los clientes asignados (orden = asignación, created_at asc). */
  clients: Client[];
  /** Compatibilidad hacia atrás: siempre clients[0] (o {} si no hay clientes). */
  client: Client;
  /** Tags asignados al viaje (0..N). Siempre [] si no hay tags, nunca null/undefined. */
  tags: Tag[];
  /** Historial de transiciones de status, orden ascendente por changedAt. */
  statusHistory: TripStatusHistoryEntry[];
  /** Fotos de la galería del viaje (0..N), ordenadas por sortOrder. */
  photos: (TripPhoto & { url: string | null })[];
  /** Documentos globales del viaje (0..N), no atados a un item específico. */
  documents: (TripDocument & { url: string | null })[];
  days: (TripDay & { items: Item[] })[];
  /** Checklist de equipaje del viaje (0..N), ordenado por sortOrder. */
  packingItems: PackingItem[];
}

export interface SiteSettings {
  email: string;
  phone: string;
  agencyName?: string;
  logoUrl?: string;
}

export interface TripFeedback {
  id: string;
  tripId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export type ItemType =
  | "flight"
  | "hotel"
  | "activity"
  | "restaurant"
  | "transport"
  | "note";

export type TripStatus = "draft" | "published" | "archived";

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  createdAt: string;
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
  budget?: number;
  status: TripStatus;
  /** Opt-in del agente Triton: si true, la vista pública muestra el resumen de costos. */
  showCostsToClient: boolean;
  createdAt: string;
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
  uploadedAt: string;
}

export interface Item {
  id: string;
  tripDayId: string;
  type: ItemType;
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
}

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
  days: (TripDay & { items: Item[] })[];
  /** Checklist de equipaje del viaje (0..N), ordenado por sortOrder. */
  packingItems: PackingItem[];
}

export interface SiteSettings {
  email: string;
  phone: string;
}

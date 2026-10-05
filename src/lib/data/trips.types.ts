import type { Client } from "@/lib/data/clients.types";
import type { Tag } from "@/lib/data/tags.types";
import type { Item } from "@/lib/data/items.types";
import type { PackingItem } from "@/lib/data/packing.types";

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
  agentIds?: string[];
};

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
  assignedAgentId?: string;
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

export interface TripFeedback {
  id: string;
  tripId: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

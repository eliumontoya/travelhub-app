import type { TripCurrency, TripStatus } from "@/types";

export interface Client {
  id: string;
  name: string;
  /** Slug público para /c/{slug} (historial de viajes publicados). Nullable: solo se genera para clientes nuevos, sin backfill. */
  slug?: string;
  email: string;
  phone: string;
  whatsapp?: string;
  notes?: string;
  referralSource?: string | null;
  birthDate?: string;
  /** Portada del perfil del cliente (vista pública /c/[slug]). Opcional. */
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

/** Cliente autenticado vía email + PIN. No contiene el PIN ni su hash. */
export type ClientSession = {
  clientId: string;
  expiresAt: number;
};

/** Vista de viaje expuesta en el home del cliente. Whitelist: nunca expone
 *  commissionRate ni internalNotes. El cliente sí ve salePrice y su agente. */
export interface ClientHomeTrip {
  id: string;
  title: string;
  slug: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string;
  status: TripStatus;
  currency: TripCurrency;
  travelerCount: number;
  salePrice?: number;
  assignedAgentId?: string;
  assignedAgentName?: string;
  serviceProgress?: { completed: number; total: number };
}

/** Vista de perfil expuesta en el home del cliente. Whitelist: omite
 *  campos internos como id, slug, createdAt, updatedAt. */
export type ClientProfileForHome = Pick<
  Client,
  "name" | "email" | "phone" | "whatsapp" | "birthDate" | "notes" | "referralSource" | "coverImageUrl"
>;

export interface ClientDocument {
  id: string;
  clientId: string;
  filePath: string;
  filename: string;
  mimeType?: string;
  createdAt: string;
}

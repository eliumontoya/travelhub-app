import type { Client } from "@/types";

export type VisaStatus = "pending" | "in_progress" | "completed";

export interface Visa {
  id: string;
  /** Compatibility mirror of clientIds[0] ("" when no clients assigned). */
  clientId: string;
  country: string;
  visaType: string;
  /** ISO date string (YYYY-MM-DD). */
  deadline: string;
  price: number;
  notes?: string;
  status: VisaStatus;
  createdAt: string;
  updatedAt: string;
}

export type VisaFilters = {
  query?: string;
  status?: VisaStatus[];
  clientIds?: string[];
  country?: string;
};

export interface VisaStatusHistoryEntry {
  id: string;
  visaId: string;
  fromStatus: VisaStatus | null;
  toStatus: VisaStatus;
  changedAt: string;
}

export type VisaDocumentStatus =
  | "requested"
  | "uploaded"
  | "reviewed"
  | "processed"
  | "re_upload_requested";

export interface VisaDocument {
  id: string;
  visaId: string;
  /** null for agent-uploaded documents; set for traveler requests. */
  targetClientId: string | null;
  /** Human label for a requested document. */
  description?: string;
  /** null until a file is uploaded. */
  filePath: string | null;
  filename?: string;
  mimeType?: string;
  status: VisaDocumentStatus;
  agentComment?: string;
  uploadedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisaWithDetails extends Visa {
  /** Source of truth: assigned clients, ordered by assignment (created_at asc). */
  clients: Client[];
  /** Backward-compat mirror: clients[0] or {} when empty. */
  client: Client;
  statusHistory: VisaStatusHistoryEntry[];
  documents: (VisaDocument & { url: string | null })[];
}

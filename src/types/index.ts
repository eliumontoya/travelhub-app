export type AccountRole = "admin" | "agent";

export type Feature =
  | "trips"
  | "clients"
  | "suppliers"
  | "travel-agents"
  | "whatsapp"
  | "settings"
  | "visas";

export interface AccountProfile {
  id: string;
  role: AccountRole;
  features: Feature[];
  travelAgentId?: string;
  email?: string;
  travelAgentName?: string;
}

export * from "@/lib/data/clients.types";
export * from "@/lib/data/items.types";
export * from "@/lib/data/packing.types";
export * from "@/lib/data/settings.types";
export * from "@/lib/data/tags.types";
export * from "@/lib/data/trips.types";
export * from "@/lib/data/visas.types";

export type ServiceType = "trip_documents";

export type ServiceUploadStatus = "uploaded" | "reviewed" | "processed" | "re_upload_requested";

export interface Service {
  id: string;
  tripId: string;
  clientId: string;
  serviceType: ServiceType;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface ServiceChecklistItem {
  id: string;
  serviceId: string;
  label: string;
  required: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceUpload {
  id: string;
  serviceId: string;
  checklistItemId: string;
  filePath: string;
  filename: string;
  mimeType?: string;
  status: ServiceUploadStatus;
  agentComment?: string;
  fileRemoved: boolean;
  uploadedAt: string;
  updatedAt: string;
}

export interface ServiceChecklistItemWithUpload extends ServiceChecklistItem {
  upload?: ServiceUpload & { url: string | null };
}

export interface ServiceWithChecklist extends Service {
  items: ServiceChecklistItemWithUpload[];
}

export interface ServiceDocumentSummary {
  serviceId: string;
  clientId: string;
  processed: number;
  total: number;
  awaitingReview: number;
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
  googlePlaceId?: string;
  notes?: string;
  tags: string[];
  deletedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TravelAgent {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

type JsonRecord = Record<string, unknown>;

export type WhatsAppOptInStatus = "unknown" | "pending" | "opted_in" | "opted_out";
export type WhatsAppConversationStatus =
  | "open"
  | "awaiting_agent"
  | "escalated"
  | "resolved"
  | "archived";
export type WhatsAppMessageDirection = "inbound" | "outbound";
export type WhatsAppMessageStatus =
  | "received"
  | "processed"
  | "responded"
  | "escalated"
  | "failed"
  | "sent";
export type WhatsAppIntentType =
  | "inquiry"
  | "quote_request"
  | "existing_trip"
  | "support"
  | "handoff"
  | "unknown";
export type WhatsAppIntentStatus = "detected" | "confirmed" | "dismissed" | "synced";
export type WhatsAppEscalationPriority = "low" | "normal" | "high" | "urgent";
export type WhatsAppEscalationStatus = "open" | "acknowledged" | "resolved" | "canceled";
export type WhatsAppKnowledgeStatus = "draft" | "approved" | "archived";
type CrmSyncEventStatus = "pending" | "processing" | "processed" | "failed";

interface WhatsAppContact {
  id: string;
  phoneE164: string;
  whatsappProfileName?: string;
  displayName?: string;
  linkedClientId?: string;
  source: "whatsapp" | string;
  optInStatus: WhatsAppOptInStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastMessageAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppConversation {
  id: string;
  contactId: string;
  assignedTripId?: string;
  channel: "whatsapp";
  status: WhatsAppConversationStatus;
  lastIntent?: string;
  lastMessageAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppMessage {
  id: string;
  conversationId: string;
  contactId: string;
  whatsappMessageId: string;
  direction: WhatsAppMessageDirection;
  messageType: string;
  body?: string;
  media: JsonRecord;
  payload: JsonRecord;
  status: WhatsAppMessageStatus;
  occurredAt: string;
  processedAt?: string;
  createdAt: string;
}

interface WhatsAppIntent {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  intentType: WhatsAppIntentType;
  confidence?: number;
  entities: JsonRecord;
  summary?: string;
  status: WhatsAppIntentStatus;
  detectedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface WhatsAppEscalation {
  id: string;
  conversationId: string;
  contactId: string;
  messageId?: string;
  intentId?: string;
  reason: string;
  priority: WhatsAppEscalationPriority;
  status: WhatsAppEscalationStatus;
  summary?: string;
  assignedTo?: string;
  openedAt: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppKnowledgeEntry {
  id: string;
  topic: string;
  question: string;
  answer: string;
  tags: string[];
  source?: string;
  status: WhatsAppKnowledgeStatus;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface CrmSyncEvent {
  id: string;
  sourceTable: string;
  sourceId: string;
  eventType: string;
  aggregateType: string;
  aggregateId?: string;
  eventKey?: string;
  status: CrmSyncEventStatus;
  payload: JsonRecord;
  attempts: number;
  lastError?: string;
  availableAt: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

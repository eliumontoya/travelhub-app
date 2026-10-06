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

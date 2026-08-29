import { isSupabaseConfigured as hasSupabaseConfig } from "@/lib/supabase/server";
import { createWccClient } from "@/lib/wcc-client";
import type {
  WhatsAppConversationStatus,
  WhatsAppIntentStatus,
  WhatsAppIntentType,
  WhatsAppMessageDirection,
  WhatsAppMessageStatus,
} from "@/types";

export const WCC_CONVERSATIONS_PAGE_SIZE = 20;
export const WCC_CONVERSATION_TIMELINE_LIMIT = 50;

export type WccConversationContact = {
  id: string;
  phoneE164: string;
  whatsappProfileName?: string;
  displayName?: string;
  linkedClientId?: string;
};

export type WccConversationMessage = {
  id: string;
  conversationId: string;
  contactId: string;
  whatsappMessageId: string;
  direction: WhatsAppMessageDirection;
  messageType: string;
  body?: string;
  status: WhatsAppMessageStatus;
  occurredAt: string;
  processedAt?: string;
  createdAt: string;
};

export type WccConversationIntent = {
  id: string;
  conversationId: string;
  messageId: string;
  contactId: string;
  intentType: WhatsAppIntentType;
  confidence?: number;
  summary?: string;
  status: WhatsAppIntentStatus;
  detectedAt: string;
};

export type WccConversationRow = {
  id: string;
  contactId: string;
  assignedTripId?: string;
  status: WhatsAppConversationStatus;
  lastIntent?: string;
  lastMessageAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
  contact?: WccConversationContact;
  latestInbound?: WccConversationMessage;
  latestOutbound?: WccConversationMessage;
  latestIntent?: WccConversationIntent;
};

export type WccConversationsList = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  conversations: WccConversationRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type WccConversationDetail = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  conversation?: WccConversationRow;
  messages: WccConversationMessage[];
  intents: WccConversationIntent[];
};

export type WccConversationsFilters = { page?: number | string };

type MultiResult<T = unknown> = { data?: T[] | null; error?: { message?: string } | null; count?: number | null };
type SingleResult<T = unknown> = { data?: T | null; error?: { message?: string } | null };
type Query = PromiseLike<MultiResult> & {
  select: (...args: unknown[]) => Query;
  eq: (...args: unknown[]) => Query;
  in: (...args: unknown[]) => Query;
  order: (...args: unknown[]) => Query;
  range: (...args: unknown[]) => Query;
  maybeSingle: () => Promise<SingleResult>;
};
type DbClient = { from: (table: string) => Query };
type RecordRow = Record<string, unknown>;

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function numberOrUndefined(value: unknown) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function normalizePage(page: unknown) {
  const numeric = typeof page === "number" ? page : Number(page ?? 1);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
}

function emptyList(filters: WccConversationsFilters = {}, overrides: Partial<WccConversationsList> = {}): WccConversationsList {
  const page = normalizePage(filters.page);
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    conversations: [],
    page,
    pageSize: WCC_CONVERSATIONS_PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
    ...overrides,
  };
}

function emptyDetail(overrides: Partial<WccConversationDetail> = {}): WccConversationDetail {
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    messages: [],
    intents: [],
    ...overrides,
  };
}

function mapContact(row: RecordRow): WccConversationContact {
  return {
    id: row.id as string,
    phoneE164: row.phone_e164 as string,
    whatsappProfileName: stringOrUndefined(row.whatsapp_profile_name),
    displayName: stringOrUndefined(row.display_name) ?? stringOrUndefined(row.whatsapp_profile_name),
    linkedClientId: stringOrUndefined(row.linked_client_id),
  };
}

function mapMessage(row: RecordRow): WccConversationMessage {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    contactId: row.contact_id as string,
    whatsappMessageId: row.whatsapp_message_id as string,
    direction: row.direction as WhatsAppMessageDirection,
    messageType: row.message_type as string,
    body: stringOrUndefined(row.body),
    status: row.status as WhatsAppMessageStatus,
    occurredAt: row.occurred_at as string,
    processedAt: stringOrUndefined(row.processed_at),
    createdAt: row.created_at as string,
  };
}

function mapIntent(row: RecordRow): WccConversationIntent {
  return {
    id: row.id as string,
    conversationId: row.conversation_id as string,
    messageId: row.message_id as string,
    contactId: row.contact_id as string,
    intentType: row.intent_type as WhatsAppIntentType,
    confidence: numberOrUndefined(row.confidence),
    summary: stringOrUndefined(row.summary),
    status: row.status as WhatsAppIntentStatus,
    detectedAt: row.detected_at as string,
  };
}

function mapConversation(row: RecordRow, contacts: Map<string, WccConversationContact>, latestInbound = new Map<string, WccConversationMessage>(), latestOutbound = new Map<string, WccConversationMessage>(), latestIntents = new Map<string, WccConversationIntent>()): WccConversationRow {
  const id = row.id as string;
  const contactId = row.contact_id as string;
  return {
    id,
    contactId,
    assignedTripId: stringOrUndefined(row.assigned_trip_id),
    status: row.status as WhatsAppConversationStatus,
    lastIntent: stringOrUndefined(row.last_intent),
    lastMessageAt: stringOrUndefined(row.last_message_at),
    lastInboundAt: stringOrUndefined(row.last_inbound_at),
    lastOutboundAt: stringOrUndefined(row.last_outbound_at),
    closedAt: stringOrUndefined(row.closed_at),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    contact: contacts.get(contactId),
    latestInbound: latestInbound.get(id),
    latestOutbound: latestOutbound.get(id),
    latestIntent: latestIntents.get(id),
  };
}

async function runRows<T>(query: Query, fallback: string) {
  const result = (await query) as MultiResult<T>;
  if (result.error) throw new Error(result.error.message ?? fallback);
  return result;
}

async function loadContacts(db: DbClient, contactIds: string[]) {
  const uniqueIds = Array.from(new Set(contactIds)).filter(Boolean);
  if (!uniqueIds.length) return new Map<string, WccConversationContact>();
  const result = await runRows<RecordRow>(
    db
      .from("whatsapp_contacts")
      .select("id, phone_e164, whatsapp_profile_name, display_name, linked_client_id")
      .in("id", uniqueIds)
      .range(0, uniqueIds.length - 1),
    "Could not read WhatsApp conversation contacts"
  );
  return new Map((result.data ?? []).map((row) => [row.id as string, mapContact(row)]));
}

function firstByConversation<T extends { conversationId: string }>(rows: T[]) {
  const grouped = new Map<string, T>();
  for (const row of rows) {
    if (!grouped.has(row.conversationId)) grouped.set(row.conversationId, row);
  }
  return grouped;
}

async function loadLatestMessagesByDirection(db: DbClient, conversationIds: string[], direction: WhatsAppMessageDirection) {
  const uniqueIds = Array.from(new Set(conversationIds)).filter(Boolean);
  if (!uniqueIds.length) return new Map<string, WccConversationMessage>();
  const result = await runRows<RecordRow>(
    db
      .from("whatsapp_messages")
      .select("id, conversation_id, contact_id, whatsapp_message_id, direction, message_type, body, status, occurred_at, processed_at, created_at")
      .in("conversation_id", uniqueIds)
      .eq("direction", direction)
      .order("occurred_at", { ascending: false })
      .range(0, Math.max(uniqueIds.length * 3 - 1, 0)),
    `Could not read latest ${direction} WhatsApp messages`
  );
  return firstByConversation((result.data ?? []).map(mapMessage));
}

async function loadLatestIntents(db: DbClient, conversationIds: string[]) {
  const uniqueIds = Array.from(new Set(conversationIds)).filter(Boolean);
  if (!uniqueIds.length) return new Map<string, WccConversationIntent>();
  const result = await runRows<RecordRow>(
    db
      .from("whatsapp_intents")
      .select("id, conversation_id, message_id, contact_id, intent_type, confidence, summary, status, detected_at")
      .in("conversation_id", uniqueIds)
      .order("detected_at", { ascending: false })
      .range(0, Math.max(uniqueIds.length * 3 - 1, 0)),
    "Could not read latest WhatsApp intents"
  );
  return firstByConversation((result.data ?? []).map(mapIntent));
}

export async function getWccConversationsList(filters: WccConversationsFilters = {}): Promise<WccConversationsList> {
  const page = normalizePage(filters.page);
  if (!hasSupabaseConfig()) return emptyList({ page });

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const from = (page - 1) * WCC_CONVERSATIONS_PAGE_SIZE;
    const to = from + WCC_CONVERSATIONS_PAGE_SIZE - 1;
    const result = await runRows<RecordRow>(
      db
        .from("whatsapp_conversations")
        .select("id, contact_id, assigned_trip_id, status, last_intent, last_message_at, last_inbound_at, last_outbound_at, closed_at, created_at, updated_at", { count: "exact" })
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to),
      "Could not read WhatsApp conversations"
    );
    const rows = result.data ?? [];
    const conversationIds = rows.map((row) => row.id as string);
    const [contacts, latestInbound, latestOutbound, latestIntents] = await Promise.all([
      loadContacts(db, rows.map((row) => row.contact_id as string)),
      loadLatestMessagesByDirection(db, conversationIds, "inbound"),
      loadLatestMessagesByDirection(db, conversationIds, "outbound"),
      loadLatestIntents(db, conversationIds),
    ]);
    const totalCount = result.count ?? rows.length;

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      conversations: rows.map((row) => mapConversation(row, contacts, latestInbound, latestOutbound, latestIntents)),
      page,
      pageSize: WCC_CONVERSATIONS_PAGE_SIZE,
      totalCount,
      totalPages: Math.ceil(totalCount / WCC_CONVERSATIONS_PAGE_SIZE),
    };
  } catch {
    return emptyList({ page }, { isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

export async function getWccConversationDetail(conversationId: string): Promise<WccConversationDetail> {
  if (!hasSupabaseConfig()) return emptyDetail();

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const conversationResult = (await db
      .from("whatsapp_conversations")
      .select("id, contact_id, assigned_trip_id, status, last_intent, last_message_at, last_inbound_at, last_outbound_at, closed_at, created_at, updated_at")
      .eq("id", conversationId)
      .maybeSingle()) as SingleResult<RecordRow>;

    if (conversationResult.error) throw new Error(conversationResult.error.message ?? "Could not read WhatsApp conversation");
    if (!conversationResult.data) return emptyDetail({ isSupabaseConfigured: true });

    const contactId = conversationResult.data.contact_id as string;
    const [contacts, messagesResult, intentsResult] = await Promise.all([
      loadContacts(db, [contactId]),
      runRows<RecordRow>(
        db
          .from("whatsapp_messages")
          .select("id, conversation_id, contact_id, whatsapp_message_id, direction, message_type, body, status, occurred_at, processed_at, created_at")
          .eq("conversation_id", conversationId)
          .order("occurred_at", { ascending: true })
          .range(0, WCC_CONVERSATION_TIMELINE_LIMIT - 1),
        "Could not read WhatsApp conversation messages"
      ),
      runRows<RecordRow>(
        db
          .from("whatsapp_intents")
          .select("id, conversation_id, message_id, contact_id, intent_type, confidence, summary, status, detected_at")
          .eq("conversation_id", conversationId)
          .order("detected_at", { ascending: true })
          .range(0, WCC_CONVERSATION_TIMELINE_LIMIT - 1),
        "Could not read WhatsApp conversation intents"
      ),
    ]);
    const messages = (messagesResult.data ?? []).map(mapMessage);
    const intents = (intentsResult.data ?? []).map(mapIntent);
    const conversation = mapConversation(
      conversationResult.data,
      contacts,
      firstByConversation(messages.filter((message) => message.direction === "inbound").slice().reverse()),
      firstByConversation(messages.filter((message) => message.direction === "outbound").slice().reverse()),
      firstByConversation(intents.slice().reverse())
    );

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      conversation,
      messages,
      intents,
    };
  } catch {
    return emptyDetail({ isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

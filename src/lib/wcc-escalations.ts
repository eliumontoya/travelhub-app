import { createClient, isSupabaseConfigured as hasSupabaseConfig } from "@/lib/supabase/server";
import type {
  WhatsAppConversationStatus,
  WhatsAppEscalationPriority,
  WhatsAppEscalationStatus,
} from "@/types";

export const WCC_ESCALATIONS_PAGE_SIZE = 20;

export const wccEscalationStatuses: WhatsAppEscalationStatus[] = ["open", "acknowledged", "resolved", "canceled"];
export const wccEscalationPriorities: WhatsAppEscalationPriority[] = ["urgent", "high", "normal", "low"];

export type WccEscalationContact = {
  id: string;
  phoneE164: string;
  whatsappProfileName?: string;
  displayName?: string;
  linkedClientId?: string;
};

export type WccEscalationConversation = {
  id: string;
  status: WhatsAppConversationStatus;
  lastIntent?: string;
  lastMessageAt?: string;
  assignedTripId?: string;
};

export type WccEscalationRow = {
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
  contact?: WccEscalationContact;
  conversation?: WccEscalationConversation;
};

export type WccEscalationsFilters = {
  page?: number;
  status?: string;
  priority?: string;
};

export type WccEscalationsQueue = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  escalations: WccEscalationRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  status?: WhatsAppEscalationStatus;
  priority?: WhatsAppEscalationPriority;
};

type MultiResult<T = unknown> = { data?: T[] | null; error?: { message?: string } | null; count?: number | null };
type Query = PromiseLike<MultiResult> & {
  select: (...args: unknown[]) => Query;
  eq: (...args: unknown[]) => Query;
  in: (...args: unknown[]) => Query;
  order: (...args: unknown[]) => Query;
  range: (...args: unknown[]) => Query;
};
type DbClient = { from: (table: string) => Query };
type RecordRow = Record<string, unknown>;

function stringOrUndefined(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function normalizePage(page: unknown) {
  const numeric = typeof page === "number" ? page : Number(page ?? 1);
  return Number.isFinite(numeric) && numeric > 0 ? Math.floor(numeric) : 1;
}

function normalizeStatus(status: unknown): WhatsAppEscalationStatus | undefined {
  return typeof status === "string" && wccEscalationStatuses.includes(status as WhatsAppEscalationStatus) ? (status as WhatsAppEscalationStatus) : undefined;
}

function normalizePriority(priority: unknown): WhatsAppEscalationPriority | undefined {
  return typeof priority === "string" && wccEscalationPriorities.includes(priority as WhatsAppEscalationPriority) ? (priority as WhatsAppEscalationPriority) : undefined;
}

function emptyQueue(filters: WccEscalationsFilters = {}, overrides: Partial<WccEscalationsQueue> = {}): WccEscalationsQueue {
  const page = normalizePage(filters.page);
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    escalations: [],
    page,
    pageSize: WCC_ESCALATIONS_PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
    status: normalizeStatus(filters.status),
    priority: normalizePriority(filters.priority),
    ...overrides,
  };
}

function mapContact(row: RecordRow): WccEscalationContact {
  return {
    id: row.id as string,
    phoneE164: row.phone_e164 as string,
    whatsappProfileName: stringOrUndefined(row.whatsapp_profile_name),
    displayName: stringOrUndefined(row.display_name) ?? stringOrUndefined(row.whatsapp_profile_name),
    linkedClientId: stringOrUndefined(row.linked_client_id),
  };
}

function mapConversation(row: RecordRow): WccEscalationConversation {
  return {
    id: row.id as string,
    status: row.status as WhatsAppConversationStatus,
    lastIntent: stringOrUndefined(row.last_intent),
    lastMessageAt: stringOrUndefined(row.last_message_at),
    assignedTripId: stringOrUndefined(row.assigned_trip_id),
  };
}

function mapEscalation(row: RecordRow, contacts: Map<string, WccEscalationContact>, conversations: Map<string, WccEscalationConversation>): WccEscalationRow {
  const contactId = row.contact_id as string;
  const conversationId = row.conversation_id as string;
  return {
    id: row.id as string,
    conversationId,
    contactId,
    messageId: stringOrUndefined(row.message_id),
    intentId: stringOrUndefined(row.intent_id),
    reason: row.reason as string,
    priority: row.priority as WhatsAppEscalationPriority,
    status: row.status as WhatsAppEscalationStatus,
    summary: stringOrUndefined(row.summary),
    assignedTo: stringOrUndefined(row.assigned_to),
    openedAt: row.opened_at as string,
    resolvedAt: stringOrUndefined(row.resolved_at),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    contact: contacts.get(contactId),
    conversation: conversations.get(conversationId),
  };
}

async function runRows<T>(query: Query, fallback: string) {
  const result = (await query) as MultiResult<T>;
  if (result.error) throw new Error(result.error.message ?? fallback);
  return result;
}

async function loadContacts(db: DbClient, contactIds: string[]) {
  const uniqueIds = Array.from(new Set(contactIds)).filter(Boolean);
  if (!uniqueIds.length) return new Map<string, WccEscalationContact>();
  const result = await runRows<RecordRow>(
    db
      .from("whatsapp_contacts")
      .select("id, phone_e164, whatsapp_profile_name, display_name, linked_client_id")
      .in("id", uniqueIds)
      .range(0, uniqueIds.length - 1),
    "Could not read WhatsApp escalation contacts"
  );
  return new Map((result.data ?? []).map((row) => [row.id as string, mapContact(row)]));
}

async function loadConversations(db: DbClient, conversationIds: string[]) {
  const uniqueIds = Array.from(new Set(conversationIds)).filter(Boolean);
  if (!uniqueIds.length) return new Map<string, WccEscalationConversation>();
  const result = await runRows<RecordRow>(
    db
      .from("whatsapp_conversations")
      .select("id, status, last_intent, last_message_at, assigned_trip_id")
      .in("id", uniqueIds)
      .range(0, uniqueIds.length - 1),
    "Could not read WhatsApp escalation conversations"
  );
  return new Map((result.data ?? []).map((row) => [row.id as string, mapConversation(row)]));
}

export async function getWccEscalationsQueue(filters: WccEscalationsFilters = {}): Promise<WccEscalationsQueue> {
  const page = normalizePage(filters.page);
  const status = normalizeStatus(filters.status);
  const priority = normalizePriority(filters.priority);
  if (!hasSupabaseConfig()) return emptyQueue({ page, status, priority });

  try {
    const db = (await createClient()) as unknown as DbClient;
    const from = (page - 1) * WCC_ESCALATIONS_PAGE_SIZE;
    const to = from + WCC_ESCALATIONS_PAGE_SIZE - 1;
    let query = db
      .from("whatsapp_escalations")
      .select("id, conversation_id, contact_id, message_id, intent_id, reason, priority, status, summary, assigned_to, opened_at, resolved_at, created_at, updated_at", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);

    const result = await runRows<RecordRow>(
      query.order("opened_at", { ascending: false }).range(from, to),
      "Could not read WhatsApp escalations"
    );
    const rows = result.data ?? [];
    const [contacts, conversations] = await Promise.all([
      loadContacts(db, rows.map((row) => row.contact_id as string)),
      loadConversations(db, rows.map((row) => row.conversation_id as string)),
    ]);
    const totalCount = result.count ?? rows.length;

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      escalations: rows.map((row) => mapEscalation(row, contacts, conversations)),
      page,
      pageSize: WCC_ESCALATIONS_PAGE_SIZE,
      totalCount,
      totalPages: Math.ceil(totalCount / WCC_ESCALATIONS_PAGE_SIZE),
      status,
      priority,
    };
  } catch {
    return emptyQueue({ page, status, priority }, { isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

import { isSupabaseConfigured as hasSupabaseConfig } from "@/lib/supabase/server";
import { createWccClient } from "@/lib/wcc-client";
import type {
  Client,
  WhatsAppConversationStatus,
  WhatsAppEscalationPriority,
  WhatsAppEscalationStatus,
  WhatsAppIntentStatus,
  WhatsAppIntentType,
  WhatsAppOptInStatus,
} from "@/types";

export const WCC_CONTACTS_PAGE_SIZE = 20;

export type WccLinkedClient = Pick<Client, "id" | "name" | "email" | "phone" | "whatsapp">;

export type WccContactRow = {
  id: string;
  phoneE164: string;
  whatsappProfileName?: string;
  displayName?: string;
  linkedClientId?: string;
  linkedClient?: WccLinkedClient;
  optInStatus: WhatsAppOptInStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  lastMessageAt?: string;
  createdAt: string;
};

export type WccConversationContext = {
  id: string;
  status: WhatsAppConversationStatus;
  lastIntent?: string;
  lastMessageAt?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  assignedTripId?: string;
};

export type WccEscalationContext = {
  id: string;
  reason: string;
  priority: WhatsAppEscalationPriority;
  status: WhatsAppEscalationStatus;
  summary?: string;
  openedAt: string;
  resolvedAt?: string;
};

export type WccIntentContext = {
  id: string;
  intentType: WhatsAppIntentType;
  confidence?: number;
  summary?: string;
  status: WhatsAppIntentStatus;
  detectedAt: string;
};

export type WccContactsList = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  contacts: WccContactRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type WccContactDetail = {
  isSupabaseConfigured: boolean;
  isConfiguredButUnavailable: boolean;
  contact?: WccContactRow;
  conversations: WccConversationContext[];
  escalations: WccEscalationContext[];
  intents: WccIntentContext[];
};

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

type ContactRecord = Record<string, unknown>;

function emptyList(page: number, overrides: Partial<WccContactsList> = {}): WccContactsList {
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    contacts: [],
    page,
    pageSize: WCC_CONTACTS_PAGE_SIZE,
    totalCount: 0,
    totalPages: 0,
    ...overrides,
  };
}

function emptyDetail(overrides: Partial<WccContactDetail> = {}): WccContactDetail {
  return {
    isSupabaseConfigured: false,
    isConfiguredButUnavailable: false,
    conversations: [],
    escalations: [],
    intents: [],
    ...overrides,
  };
}

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

function mapClient(row: Record<string, unknown>): WccLinkedClient {
  return {
    id: row.id as string,
    name: (row.name as string) ?? "Cliente sin nombre",
    email: (row.email as string | null) ?? "",
    phone: (row.phone as string | null) ?? "",
    whatsapp: stringOrUndefined(row.whatsapp),
  };
}

function mapContact(row: ContactRecord, clientsById: Map<string, WccLinkedClient> = new Map()): WccContactRow {
  const linkedClientId = stringOrUndefined(row.linked_client_id);
  return {
    id: row.id as string,
    phoneE164: row.phone_e164 as string,
    whatsappProfileName: stringOrUndefined(row.whatsapp_profile_name),
    displayName: stringOrUndefined(row.display_name) ?? stringOrUndefined(row.whatsapp_profile_name),
    linkedClientId,
    linkedClient: linkedClientId ? clientsById.get(linkedClientId) : undefined,
    optInStatus: row.opt_in_status as WhatsAppOptInStatus,
    firstSeenAt: row.first_seen_at as string,
    lastSeenAt: row.last_seen_at as string,
    lastMessageAt: stringOrUndefined(row.last_message_at),
    createdAt: row.created_at as string,
  };
}

async function loadLinkedClients(db: DbClient, linkedClientIds: string[]) {
  const uniqueIds = Array.from(new Set(linkedClientIds)).filter(Boolean);
  if (!uniqueIds.length) return new Map<string, WccLinkedClient>();

  const result = (await db
    .from("clients")
    .select("id, name, email, phone, whatsapp")
    .in("id", uniqueIds)
    .range(0, uniqueIds.length - 1)) as MultiResult<Record<string, unknown>>;

  if (result.error) throw new Error(result.error.message ?? "Could not read linked clients");
  return new Map((result.data ?? []).map((row) => [row.id as string, mapClient(row)]));
}

async function runRows<T>(query: Query, fallback: string) {
  const result = (await query) as MultiResult<T>;
  if (result.error) throw new Error(result.error.message ?? fallback);
  return result;
}

export async function getWccContactsList(page = 1): Promise<WccContactsList> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  if (!hasSupabaseConfig()) return emptyList(safePage);

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const from = (safePage - 1) * WCC_CONTACTS_PAGE_SIZE;
    const to = from + WCC_CONTACTS_PAGE_SIZE - 1;
    const result = await runRows<ContactRecord>(
      db
        .from("whatsapp_contacts")
        .select("id, phone_e164, whatsapp_profile_name, display_name, linked_client_id, opt_in_status, first_seen_at, last_seen_at, last_message_at, created_at", { count: "exact" })
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .range(from, to),
      "Could not read WhatsApp contacts"
    );
    const rows = result.data ?? [];
    const clientsById = await loadLinkedClients(db, rows.map((row) => stringOrUndefined(row.linked_client_id)).filter((id): id is string => Boolean(id)));
    const totalCount = result.count ?? rows.length;

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      contacts: rows.map((row) => mapContact(row, clientsById)),
      page: safePage,
      pageSize: WCC_CONTACTS_PAGE_SIZE,
      totalCount,
      totalPages: Math.ceil(totalCount / WCC_CONTACTS_PAGE_SIZE),
    };
  } catch {
    return emptyList(safePage, { isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

export async function getWccContactDetail(contactId: string): Promise<WccContactDetail> {
  if (!hasSupabaseConfig()) return emptyDetail();

  try {
    const db = (await createWccClient()) as unknown as DbClient;
    const contactResult = (await db
      .from("whatsapp_contacts")
      .select("id, phone_e164, whatsapp_profile_name, display_name, linked_client_id, opt_in_status, first_seen_at, last_seen_at, last_message_at, created_at")
      .eq("id", contactId)
      .maybeSingle()) as SingleResult<ContactRecord>;

    if (contactResult.error) throw new Error(contactResult.error.message ?? "Could not read WhatsApp contact");
    if (!contactResult.data) return emptyDetail({ isSupabaseConfigured: true });

    const clientsById = await loadLinkedClients(db, [stringOrUndefined(contactResult.data.linked_client_id)].filter((id): id is string => Boolean(id)));
    const [conversationsResult, escalationsResult, intentsResult] = await Promise.all([
      runRows<Record<string, unknown>>(
        db
          .from("whatsapp_conversations")
          .select("id, status, last_intent, last_message_at, last_inbound_at, last_outbound_at, assigned_trip_id")
          .eq("contact_id", contactId)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .range(0, 9),
        "Could not read WhatsApp conversations"
      ),
      runRows<Record<string, unknown>>(
        db
          .from("whatsapp_escalations")
          .select("id, reason, priority, status, summary, opened_at, resolved_at")
          .eq("contact_id", contactId)
          .order("opened_at", { ascending: false })
          .range(0, 9),
        "Could not read WhatsApp escalations"
      ),
      runRows<Record<string, unknown>>(
        db
          .from("whatsapp_intents")
          .select("id, intent_type, confidence, summary, status, detected_at")
          .eq("contact_id", contactId)
          .order("detected_at", { ascending: false })
          .range(0, 9),
        "Could not read WhatsApp intents"
      ),
    ]);

    return {
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      contact: mapContact(contactResult.data, clientsById),
      conversations: (conversationsResult.data ?? []).map((row) => ({
        id: row.id as string,
        status: row.status as WhatsAppConversationStatus,
        lastIntent: stringOrUndefined(row.last_intent),
        lastMessageAt: stringOrUndefined(row.last_message_at),
        lastInboundAt: stringOrUndefined(row.last_inbound_at),
        lastOutboundAt: stringOrUndefined(row.last_outbound_at),
        assignedTripId: stringOrUndefined(row.assigned_trip_id),
      })),
      escalations: (escalationsResult.data ?? []).map((row) => ({
        id: row.id as string,
        reason: row.reason as string,
        priority: row.priority as WhatsAppEscalationPriority,
        status: row.status as WhatsAppEscalationStatus,
        summary: stringOrUndefined(row.summary),
        openedAt: row.opened_at as string,
        resolvedAt: stringOrUndefined(row.resolved_at),
      })),
      intents: (intentsResult.data ?? []).map((row) => ({
        id: row.id as string,
        intentType: row.intent_type as WhatsAppIntentType,
        confidence: numberOrUndefined(row.confidence),
        summary: stringOrUndefined(row.summary),
        status: row.status as WhatsAppIntentStatus,
        detectedAt: row.detected_at as string,
      })),
    };
  } catch {
    return emptyDetail({ isSupabaseConfigured: true, isConfiguredButUnavailable: true });
  }
}

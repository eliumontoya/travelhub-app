import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { NormalizedWhatsAppInboundEvent } from "./normalize";

export type WhatsAppIngestionResult = {
  received: number;
  inserted: number;
  duplicates: number;
};

export class WhatsAppStoreConfigurationError extends Error {
  constructor(message = "WhatsApp webhook persistence is not configured") {
    super(message);
    this.name = "WhatsAppStoreConfigurationError";
  }
}

type WhatsAppSupabaseClient = Pick<SupabaseClient, "from">;

type SingleResult<T> = {
  data: T | null;
  error: { message?: string; code?: string } | null;
};

type IdRow = { id: string };

function getServiceRoleClient(): WhatsAppSupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new WhatsAppStoreConfigurationError();
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function throwIfError(error: SingleResult<unknown>["error"], fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

export async function upsertWhatsAppContact(client: WhatsAppSupabaseClient, event: NormalizedWhatsAppInboundEvent) {
  const now = new Date().toISOString();
  const result = (await client
    .from("whatsapp_contacts")
    .upsert(
      {
        phone_e164: event.fromPhone,
        whatsapp_profile_name: event.profileName ?? null,
        display_name: event.profileName ?? null,
        source: "whatsapp",
        last_seen_at: now,
        last_message_at: event.occurredAt,
      },
      { onConflict: "phone_e164" }
    )
    .select("id")
    .single()) as SingleResult<IdRow>;

  throwIfError(result.error, "Could not upsert WhatsApp contact");
  if (!result.data) throw new Error("Could not upsert WhatsApp contact");
  return result.data.id;
}

export async function getOrCreateOpenWhatsAppConversation(
  client: WhatsAppSupabaseClient,
  contactId: string,
  event: NormalizedWhatsAppInboundEvent
) {
  const existing = (await client
    .from("whatsapp_conversations")
    .select("id")
    .eq("contact_id", contactId)
    .eq("channel", "whatsapp")
    .eq("status", "open")
    .maybeSingle()) as SingleResult<IdRow>;

  throwIfError(existing.error, "Could not read WhatsApp conversation");
  if (existing.data) return existing.data.id;

  const created = (await client
    .from("whatsapp_conversations")
    .insert({
      contact_id: contactId,
      channel: "whatsapp",
      status: "open",
      last_message_at: event.occurredAt,
      last_inbound_at: event.occurredAt,
    })
    .select("id")
    .single()) as SingleResult<IdRow>;

  throwIfError(created.error, "Could not create WhatsApp conversation");
  if (!created.data) throw new Error("Could not create WhatsApp conversation");
  return created.data.id;
}

async function insertInboundMessage(
  client: WhatsAppSupabaseClient,
  event: NormalizedWhatsAppInboundEvent,
  contactId: string,
  conversationId: string
) {
  const inserted = (await client
    .from("whatsapp_messages")
    .upsert(
      {
        conversation_id: conversationId,
        contact_id: contactId,
        whatsapp_message_id: event.providerMessageId,
        direction: "inbound",
        message_type: event.messageType,
        body: event.body ?? null,
        media: event.messageType === "text" ? {} : event.rawMessage,
        payload: {
          normalized: {
            providerMessageId: event.providerMessageId,
            fromPhone: event.fromPhone,
            profileName: event.profileName,
            businessPhoneNumberId: event.businessPhoneNumberId,
            messageType: event.messageType,
            body: event.body,
            occurredAt: event.occurredAt,
          },
          rawMessage: event.rawMessage,
          rawValue: event.rawValue,
        },
        status: "received",
        occurred_at: event.occurredAt,
      },
      { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle()) as SingleResult<IdRow>;

  throwIfError(inserted.error, "Could not insert WhatsApp message");
  return inserted.data?.id ?? null;
}

async function touchConversation(
  client: WhatsAppSupabaseClient,
  conversationId: string,
  event: NormalizedWhatsAppInboundEvent
) {
  const result = (await client
    .from("whatsapp_conversations")
    .update({ last_message_at: event.occurredAt, last_inbound_at: event.occurredAt })
    .eq("id", conversationId)) as SingleResult<unknown>;

  throwIfError(result.error, "Could not update WhatsApp conversation");
}

export async function ingestWhatsAppInboundEvents(
  events: NormalizedWhatsAppInboundEvent[],
  client = getServiceRoleClient()
): Promise<WhatsAppIngestionResult> {
  let inserted = 0;
  let duplicates = 0;

  for (const event of events) {
    const contactId = await upsertWhatsAppContact(client, event);
    const conversationId = await getOrCreateOpenWhatsAppConversation(client, contactId, event);
    const wasInserted = await insertInboundMessage(client, event, contactId, conversationId);
    await touchConversation(client, conversationId, event);

    if (wasInserted) inserted += 1;
    else duplicates += 1;
  }

  return { received: events.length, inserted, duplicates };
}

export type PersistedWhatsAppInboundEvent = {
  inserted: boolean;
  contactId: string;
  conversationId: string;
  messageId: string;
};

export type WhatsAppConversationContext = {
  assignedTripId: string | null;
  lastIntent: string | null;
};

type JsonPayload = Record<string, unknown>;

export type WhatsAppStore = {
  persistInboundEvent(event: NormalizedWhatsAppInboundEvent): Promise<PersistedWhatsAppInboundEvent>;
  loadConversationContext(conversationId: string): Promise<WhatsAppConversationContext>;
  createIntent(input: { persisted: PersistedWhatsAppInboundEvent; decision: { intent: string; confidence: number; summary: string; citedKnowledgeIds: string[]; providerDiagnostics?: JsonPayload } }): Promise<{ id: string }>;
  insertOutboundMessage(input: {
    persisted: PersistedWhatsAppInboundEvent;
    purpose: string;
    body: string;
    status: "sent" | "failed";
    sendResult: JsonPayload;
  }): Promise<{ id: string }>;
  createEscalation(input: {
    persisted: PersistedWhatsAppInboundEvent;
    intentId: string;
    escalation: { reason: string; priority: "low" | "normal" | "high" | "urgent"; summary: string };
  }): Promise<{ id: string }>;
  createCrmSyncEvent(input: {
    sourceTable: string;
    sourceId: string;
    eventType: string;
    aggregateType: string;
    aggregateId?: string;
    eventKey?: string;
    payload: JsonPayload;
  }): Promise<{ id: string }>;
  updateConversationStatus(input: {
    conversationId: string;
    status: "open" | "awaiting_agent" | "escalated" | "resolved" | "archived";
    lastIntent?: string;
    lastOutboundAt?: string;
  }): Promise<void>;
  markInboundMessageProcessed(input: { messageId: string; status: "processed" | "responded" | "escalated" | "failed" }): Promise<void>;
};

async function selectExistingMessageId(client: WhatsAppSupabaseClient, providerMessageId: string) {
  const existing = (await client
    .from("whatsapp_messages")
    .select("id, conversation_id, contact_id")
    .eq("whatsapp_message_id", providerMessageId)
    .maybeSingle()) as SingleResult<{ id: string; conversation_id: string; contact_id: string }>;

  throwIfError(existing.error, "Could not read existing WhatsApp message");
  return existing.data;
}

export async function persistWhatsAppInboundEvent(
  event: NormalizedWhatsAppInboundEvent,
  client = getServiceRoleClient()
): Promise<PersistedWhatsAppInboundEvent> {
  const contactId = await upsertWhatsAppContact(client, event);
  const conversationId = await getOrCreateOpenWhatsAppConversation(client, contactId, event);
  const messageId = await insertInboundMessage(client, event, contactId, conversationId);
  await touchConversation(client, conversationId, event);

  if (messageId) return { inserted: true, contactId, conversationId, messageId };

  const existing = await selectExistingMessageId(client, event.providerMessageId);
  return {
    inserted: false,
    contactId: existing?.contact_id ?? contactId,
    conversationId: existing?.conversation_id ?? conversationId,
    messageId: existing?.id ?? event.providerMessageId,
  };
}

export async function loadWhatsAppConversationContext(
  conversationId: string,
  client = getServiceRoleClient()
): Promise<WhatsAppConversationContext> {
  const result = (await client
    .from("whatsapp_conversations")
    .select("assigned_trip_id, last_intent")
    .eq("id", conversationId)
    .maybeSingle()) as SingleResult<{ assigned_trip_id: string | null; last_intent: string | null }>;

  throwIfError(result.error, "Could not load WhatsApp conversation context");
  return {
    assignedTripId: result.data?.assigned_trip_id ?? null,
    lastIntent: result.data?.last_intent ?? null,
  };
}

export async function createWhatsAppIntent(
  input: { persisted: PersistedWhatsAppInboundEvent; decision: { intent: string; confidence: number; summary: string; citedKnowledgeIds: string[]; providerDiagnostics?: JsonPayload } },
  client = getServiceRoleClient()
) {
  const result = (await client
    .from("whatsapp_intents")
    .insert({
      conversation_id: input.persisted.conversationId,
      message_id: input.persisted.messageId,
      contact_id: input.persisted.contactId,
      intent_type: input.decision.intent,
      confidence: input.decision.confidence,
      entities: {
        citedKnowledgeIds: input.decision.citedKnowledgeIds,
        ...(input.decision.providerDiagnostics ? { providerDiagnostics: input.decision.providerDiagnostics } : {}),
      },
      summary: input.decision.summary,
      status: "detected",
    })
    .select("id")
    .single()) as SingleResult<IdRow>;

  throwIfError(result.error, "Could not create WhatsApp intent");
  if (!result.data) throw new Error("Could not create WhatsApp intent");
  return result.data;
}

export async function insertWhatsAppOutboundMessage(
  input: {
    persisted: PersistedWhatsAppInboundEvent;
    purpose: string;
    body: string;
    status: "sent" | "failed";
    sendResult: JsonPayload;
  },
  client = getServiceRoleClient()
) {
  const result = (await client
    .from("whatsapp_messages")
    .upsert(
      {
        conversation_id: input.persisted.conversationId,
        contact_id: input.persisted.contactId,
        whatsapp_message_id: `out:${input.purpose}:${input.persisted.messageId}`,
        direction: "outbound",
        message_type: "text",
        body: input.body,
        media: {},
        payload: { purpose: input.purpose, sendResult: input.sendResult },
        status: input.status,
        occurred_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      },
      { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle()) as SingleResult<IdRow>;

  throwIfError(result.error, "Could not insert WhatsApp outbound message");
  return { id: result.data?.id ?? `out:${input.purpose}:${input.persisted.messageId}` };
}

export async function createWhatsAppEscalation(
  input: {
    persisted: PersistedWhatsAppInboundEvent;
    intentId: string;
    escalation: { reason: string; priority: "low" | "normal" | "high" | "urgent"; summary: string };
  },
  client = getServiceRoleClient()
) {
  const result = (await client
    .from("whatsapp_escalations")
    .insert({
      conversation_id: input.persisted.conversationId,
      contact_id: input.persisted.contactId,
      message_id: input.persisted.messageId,
      intent_id: input.intentId,
      reason: input.escalation.reason,
      priority: input.escalation.priority,
      status: "open",
      summary: input.escalation.summary,
    })
    .select("id")
    .single()) as SingleResult<IdRow>;

  throwIfError(result.error, "Could not create WhatsApp escalation");
  if (!result.data) throw new Error("Could not create WhatsApp escalation");
  return result.data;
}

export async function createCrmSyncEvent(
  input: {
    sourceTable: string;
    sourceId: string;
    eventType: string;
    aggregateType: string;
    aggregateId?: string;
    eventKey?: string;
    payload: JsonPayload;
  },
  client = getServiceRoleClient()
) {
  const result = (await client
    .from("crm_sync_events")
    .upsert(
      {
        source_table: input.sourceTable,
        source_id: input.sourceId,
        event_type: input.eventType,
        aggregate_type: input.aggregateType,
        aggregate_id: input.aggregateId ?? null,
        event_key: input.eventKey ?? null,
        status: "pending",
        payload: input.payload,
      },
      { onConflict: "event_key", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle()) as SingleResult<IdRow>;

  throwIfError(result.error, "Could not create CRM sync event");
  return { id: result.data?.id ?? input.eventKey ?? input.sourceId };
}

export async function updateWhatsAppConversationStatus(
  input: {
    conversationId: string;
    status: "open" | "awaiting_agent" | "escalated" | "resolved" | "archived";
    lastIntent?: string;
    lastOutboundAt?: string;
  },
  client = getServiceRoleClient()
) {
  const result = (await client
    .from("whatsapp_conversations")
    .update({
      status: input.status,
      last_intent: input.lastIntent ?? null,
      last_outbound_at: input.lastOutboundAt ?? null,
      last_message_at: input.lastOutboundAt ?? new Date().toISOString(),
    })
    .eq("id", input.conversationId)) as SingleResult<unknown>;

  throwIfError(result.error, "Could not update WhatsApp conversation status");
}

export async function markWhatsAppInboundMessageProcessed(
  input: { messageId: string; status: "processed" | "responded" | "escalated" | "failed" },
  client = getServiceRoleClient()
) {
  const result = (await client
    .from("whatsapp_messages")
    .update({ status: input.status, processed_at: new Date().toISOString() })
    .eq("id", input.messageId)) as SingleResult<unknown>;

  throwIfError(result.error, "Could not mark WhatsApp inbound message processed");
}

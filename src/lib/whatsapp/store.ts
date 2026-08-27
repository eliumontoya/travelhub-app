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

async function upsertContact(client: WhatsAppSupabaseClient, event: NormalizedWhatsAppInboundEvent) {
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

async function getOrCreateOpenConversation(
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
  return Boolean(inserted.data);
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
    const contactId = await upsertContact(client, event);
    const conversationId = await getOrCreateOpenConversation(client, contactId, event);
    const wasInserted = await insertInboundMessage(client, event, contactId, conversationId);
    await touchConversation(client, conversationId, event);

    if (wasInserted) inserted += 1;
    else duplicates += 1;
  }

  return { received: events.length, inserted, duplicates };
}

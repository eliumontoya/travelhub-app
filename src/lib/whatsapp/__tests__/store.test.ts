import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NormalizedWhatsAppInboundEvent } from "@/lib/whatsapp/normalize";

const createClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

function createQuery(result: unknown) {
  const query = {
    upsert: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
  };
  return query;
}

function makeClient(messageInsertResult: { data: { id: string } | null; error: null }) {
  const contact = createQuery({ data: { id: "contact-1" }, error: null });
  const existingConversation = createQuery({ data: { id: "conversation-1" }, error: null });
  const message = createQuery(messageInsertResult);
  const conversationUpdate = createQuery({ data: null, error: null });
  const calls: Record<string, unknown[]> = {
    whatsapp_contacts: [],
    whatsapp_conversations: [],
    whatsapp_messages: [],
  };

  return {
    calls,
    contact,
    existingConversation,
    message,
    conversationUpdate,
    client: {
      from: vi.fn((table: string) => {
        if (!calls[table]) calls[table] = [];
        calls[table].push(table);
        if (table === "whatsapp_contacts") return contact;
        if (table === "whatsapp_messages") return message;
        if (table === "whatsapp_conversations" && calls[table].length === 1) return existingConversation;
        if (table === "whatsapp_conversations") return conversationUpdate;
        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
}


function makeIntentClient() {
  const intent = createQuery({ data: { id: "intent-1" }, error: null });

  return {
    intent,
    client: {
      from: vi.fn((table: string) => {
        if (table === "whatsapp_intents") return intent;
        throw new Error(`Unexpected table ${table}`);
      }),
    },
  };
}

const event: NormalizedWhatsAppInboundEvent = {
  providerMessageId: "wamid.text-1",
  fromPhone: "5215551234567",
  profileName: "Jane Traveler",
  businessPhoneNumberId: "phone-number-id-1",
  messageType: "text",
  body: "Hola",
  occurredAt: "2026-12-25T00:00:00.000Z",
  rawMessage: { id: "wamid.text-1", type: "text" },
  rawValue: { messaging_product: "whatsapp" },
};

describe("ingestWhatsAppInboundEvents", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-secret";
  });

  it("uses service-role Supabase configuration and inserts inbound messages", async () => {
    const mock = makeClient({ data: { id: "message-1" }, error: null });
    createClient.mockReturnValueOnce(mock.client);
    const { ingestWhatsAppInboundEvents } = await import("@/lib/whatsapp/store");

    const result = await ingestWhatsAppInboundEvents([event]);

    expect(result).toEqual({ received: 1, inserted: 1, duplicates: 0 });
    expect(createClient).toHaveBeenCalledWith(
      "https://supabase.test",
      "service-role-secret",
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    expect(mock.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ phone_e164: "5215551234567", whatsapp_profile_name: "Jane Traveler" }),
      { onConflict: "phone_e164" }
    );
    expect(mock.message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp_message_id: "wamid.text-1", direction: "inbound", body: "Hola" }),
      { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
    );
  });

  it("counts duplicate provider message ids without throwing", async () => {
    const mock = makeClient({ data: null, error: null });
    createClient.mockReturnValueOnce(mock.client);
    const { ingestWhatsAppInboundEvents } = await import("@/lib/whatsapp/store");

    const result = await ingestWhatsAppInboundEvents([event]);

    expect(result).toEqual({ received: 1, inserted: 0, duplicates: 1 });
    expect(mock.message.upsert).toHaveBeenCalledWith(
      expect.any(Object),
      { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
    );
  });

  it("fails safely when service-role persistence is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { ingestWhatsAppInboundEvents, WhatsAppStoreConfigurationError } = await import(
      "@/lib/whatsapp/store"
    );

    await expect(ingestWhatsAppInboundEvents([event])).rejects.toBeInstanceOf(
      WhatsAppStoreConfigurationError
    );
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("createWhatsAppIntent", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockReset();
  });

  it("persists safe provider diagnostics in intent entities", async () => {
    const mock = makeIntentClient();
    const { createWhatsAppIntent } = await import("@/lib/whatsapp/store");
    const providerDiagnostics = {
      providerErrorType: "invalid_structured_output",
      rawOutputPreview: '{"intent":"destination_info"}',
      validationIssues: [{ path: "intent", message: "Invalid enum value" }],
    };

    const result = await createWhatsAppIntent(
      {
        persisted: {
          inserted: true,
          contactId: "contact-1",
          conversationId: "conversation-1",
          messageId: "message-1",
        },
        decision: {
          intent: "unknown",
          confidence: 0,
          summary: "Salida estructurada inválida del proveedor.",
          citedKnowledgeIds: [],
          providerDiagnostics,
        },
      },
      mock.client as never
    );

    expect(result).toEqual({ id: "intent-1" });
    expect(mock.intent.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_id: "conversation-1",
        message_id: "message-1",
        contact_id: "contact-1",
        intent_type: "unknown",
        confidence: 0,
        entities: {
          citedKnowledgeIds: [],
          providerDiagnostics,
        },
        summary: "Salida estructurada inválida del proveedor.",
        status: "detected",
      })
    );
  });
});

describe("persistWhatsAppStatusEvents", () => {
  it("idempotently stores callback, updates matched outbound message, and stages CRM event", async () => {
    const outboundMessage = createQuery({
      data: {
        id: "outbound-row-1",
        conversation_id: "conversation-1",
        contact_id: "contact-1",
        status: "sent",
        payload: { purpose: "auto_answer", sendResult: { providerMessageId: "wamid.out-1" } },
      },
      error: null,
    });
    const callback = createQuery({ data: { id: "callback-1" }, error: null });
    const messageUpdate = createQuery({ data: null, error: null });
    const crm = createQuery({ data: { id: "crm-1" }, error: null });
    const calls: Record<string, number> = {};
    const client = {
      from: vi.fn((table: string) => {
        calls[table] = (calls[table] ?? 0) + 1;
        if (table === "whatsapp_messages" && calls[table] === 1) return outboundMessage;
        if (table === "whatsapp_messages") return messageUpdate;
        if (table === "whatsapp_message_status_callbacks") return callback;
        if (table === "crm_sync_events") return crm;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const { persistWhatsAppStatusEvents } = await import("@/lib/whatsapp/store");

    const result = await persistWhatsAppStatusEvents(
      [
        {
          providerMessageId: "wamid.out-1",
          status: "delivered",
          recipientPhone: "5215551234567",
          businessPhoneNumberId: "phone-id-1",
          occurredAt: "2026-12-25T00:05:00.000Z",
          errors: [],
          rawStatus: { id: "wamid.out-1", status: "delivered" },
          rawValue: { messaging_product: "whatsapp" },
        },
      ],
      client as never
    );

    expect(result).toEqual({ received: 1, inserted: 1, duplicates: 0, matched: 1, updated: 1 });
    expect(callback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        callback_key: "whatsapp:status:wamid.out-1:delivered:2026-12-25T00:05:00.000Z",
        message_id: "outbound-row-1",
        whatsapp_message_id: "wamid.out-1",
        status: "delivered",
      }),
      { onConflict: "callback_key", ignoreDuplicates: true }
    );
    expect(messageUpdate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "delivered",
        payload: expect.objectContaining({
          purpose: "auto_answer",
          deliveryStatus: expect.objectContaining({ status: "delivered" }),
        }),
      })
    );
    expect(crm.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "whatsapp.delivery_delivered", event_key: "whatsapp:status:wamid.out-1:delivered:2026-12-25T00:05:00.000Z" }),
      { onConflict: "event_key", ignoreDuplicates: true }
    );
  });

  it("stores failed callback errors even when no outbound message is matched", async () => {
    const outboundMessage = createQuery({ data: null, error: null });
    const callback = createQuery({ data: null, error: null });
    const client = {
      from: vi.fn((table: string) => {
        if (table === "whatsapp_messages") return outboundMessage;
        if (table === "whatsapp_message_status_callbacks") return callback;
        throw new Error(`Unexpected table ${table}`);
      }),
    };
    const { persistWhatsAppStatusEvents } = await import("@/lib/whatsapp/store");

    const result = await persistWhatsAppStatusEvents(
      [
        {
          providerMessageId: "wamid.out-missing",
          status: "failed",
          recipientPhone: "5215551234567",
          occurredAt: "2026-12-25T00:06:00.000Z",
          errors: [{ code: 131026, title: "Message undeliverable" }],
          rawStatus: { id: "wamid.out-missing", status: "failed" },
          rawValue: { messaging_product: "whatsapp" },
        },
      ],
      client as never
    );

    expect(result).toEqual({ received: 1, inserted: 0, duplicates: 1, matched: 0, updated: 0 });
    expect(callback.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        message_id: null,
        status: "failed",
        payload: expect.objectContaining({ errors: [{ code: 131026, title: "Message undeliverable" }] }),
      }),
      { onConflict: "callback_key", ignoreDuplicates: true }
    );
  });
});

describe("insertWhatsAppOutboundMessage", () => {
  it("uses Meta provider message id for outbound rows when available", async () => {
    const message = createQuery({ data: { id: "outbound-row-1" }, error: null });
    const client = { from: vi.fn((table: string) => {
      if (table === "whatsapp_messages") return message;
      throw new Error(`Unexpected table ${table}`);
    }) };
    const { insertWhatsAppOutboundMessage } = await import("@/lib/whatsapp/store");

    await insertWhatsAppOutboundMessage(
      {
        persisted: { inserted: true, contactId: "contact-1", conversationId: "conversation-1", messageId: "inbound-1" },
        purpose: "auto_answer",
        body: "Hola",
        status: "sent",
        sendResult: { ok: true, providerMessageId: "wamid.out-real" },
      },
      client as never
    );

    expect(message.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ whatsapp_message_id: "wamid.out-real", direction: "outbound" }),
      { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
    );
  });
});

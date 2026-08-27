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

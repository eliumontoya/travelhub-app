import { beforeEach, describe, expect, it, vi } from "vitest";

const isSupabaseConfigured = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured, createClient }));

type Result = { data?: unknown[] | null; error?: { message: string } | null; count?: number | null };
type SingleResult = { data?: unknown | null; error?: { message: string } | null };
function query(result: Result, single?: SingleResult) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(() => q),
    maybeSingle: vi.fn(async () => single ?? { data: null, error: null }),
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return q;
}

function mockDb(tables: Record<string, ReturnType<typeof query>[]>) {
  createClient.mockResolvedValue({ from: vi.fn((table: string) => tables[table].shift()) });
}

const conversationRow = {
  id: "cv1",
  contact_id: "ct1",
  assigned_trip_id: "trip1",
  status: "open",
  last_intent: "support",
  last_message_at: "2026-08-28T10:05:00.000Z",
  last_inbound_at: "2026-08-28T10:01:00.000Z",
  last_outbound_at: "2026-08-28T10:05:00.000Z",
  closed_at: null,
  created_at: "2026-08-28T10:00:00.000Z",
  updated_at: "2026-08-28T10:05:00.000Z",
};

const contactRow = {
  id: "ct1",
  phone_e164: "+5215512345678",
  whatsapp_profile_name: "Jane WA",
  display_name: "Jane",
  linked_client_id: "cl1",
};

const inboundMessage = {
  id: "msg1",
  conversation_id: "cv1",
  contact_id: "ct1",
  whatsapp_message_id: "wamid.1",
  direction: "inbound",
  message_type: "text",
  body: "Necesito ayuda",
  status: "processed",
  occurred_at: "2026-08-28T10:01:00.000Z",
  processed_at: "2026-08-28T10:01:10.000Z",
  created_at: "2026-08-28T10:01:00.000Z",
};

const outboundMessage = {
  id: "msg2",
  conversation_id: "cv1",
  contact_id: "ct1",
  whatsapp_message_id: "wamid.2",
  direction: "outbound",
  message_type: "text",
  body: "Ya te ayudo",
  status: "sent",
  occurred_at: "2026-08-28T10:05:00.000Z",
  processed_at: null,
  created_at: "2026-08-28T10:05:00.000Z",
};

const intentRow = {
  id: "in1",
  conversation_id: "cv1",
  message_id: "msg1",
  contact_id: "ct1",
  intent_type: "support",
  confidence: 0.92,
  summary: "Solicita ayuda",
  status: "detected",
  detected_at: "2026-08-28T10:01:12.000Z",
};

describe("getWccConversationsList", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(false);
  });

  it("returns a safe empty list without Supabase", async () => {
    const { getWccConversationsList } = await import("@/lib/wcc-conversations");
    await expect(getWccConversationsList()).resolves.toMatchObject({
      isSupabaseConfigured: false,
      isConfiguredButUnavailable: false,
      conversations: [],
      page: 1,
      totalCount: 0,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("maps conversations with batched contact, message, and intent context", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    mockDb({
      whatsapp_conversations: [query({ data: [conversationRow], count: 21, error: null })],
      whatsapp_contacts: [query({ data: [contactRow], error: null })],
      whatsapp_messages: [query({ data: [inboundMessage], error: null }), query({ data: [outboundMessage], error: null })],
      whatsapp_intents: [query({ data: [intentRow], error: null })],
    });

    const { getWccConversationsList } = await import("@/lib/wcc-conversations");
    const result = await getWccConversationsList({ page: "2" });

    expect(result).toMatchObject({
      isSupabaseConfigured: true,
      totalCount: 21,
      totalPages: 2,
      page: 2,
      conversations: [{ id: "cv1", contact: { displayName: "Jane" }, latestInbound: { body: "Necesito ayuda" }, latestOutbound: { status: "sent" }, latestIntent: { intentType: "support" } }],
    });
  });

  it("falls back safely when configured Supabase list reads fail", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    createClient.mockResolvedValue({ from: vi.fn(() => query({ error: { message: "relation does not exist" } })) });

    const { getWccConversationsList } = await import("@/lib/wcc-conversations");
    await expect(getWccConversationsList()).resolves.toMatchObject({
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: true,
      conversations: [],
    });
  });
});

describe("getWccConversationDetail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
  });

  it("maps conversation detail timeline without mutations", async () => {
    mockDb({
      whatsapp_conversations: [query({}, { data: conversationRow, error: null })],
      whatsapp_contacts: [query({ data: [contactRow], error: null })],
      whatsapp_messages: [query({ data: [inboundMessage, outboundMessage], error: null })],
      whatsapp_intents: [query({ data: [intentRow], error: null })],
    });

    const { getWccConversationDetail } = await import("@/lib/wcc-conversations");
    await expect(getWccConversationDetail("cv1")).resolves.toMatchObject({
      conversation: { id: "cv1", contact: { id: "ct1" }, latestInbound: { id: "msg1" }, latestOutbound: { id: "msg2" }, latestIntent: { id: "in1" } },
      messages: [{ id: "msg1", direction: "inbound" }, { id: "msg2", direction: "outbound" }],
      intents: [{ id: "in1", messageId: "msg1", confidence: 0.92 }],
    });
  });

  it("returns empty configured detail when conversation is missing", async () => {
    mockDb({ whatsapp_conversations: [query({}, { data: null, error: null })] });

    const { getWccConversationDetail } = await import("@/lib/wcc-conversations");
    const result = await getWccConversationDetail("missing");
    expect(result).toMatchObject({
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: false,
      messages: [],
      intents: [],
    });
    expect(result.conversation).toBeUndefined();
  });
});

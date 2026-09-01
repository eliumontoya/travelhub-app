import { beforeEach, describe, expect, it, vi } from "vitest";

const isSupabaseConfigured = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured, createClient }));

type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };
function query(result: Result) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(async () => result),
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return q;
}

function mockDb(tables: Record<string, ReturnType<typeof query>[]>) {
  createClient.mockResolvedValue({ from: vi.fn((table: string) => tables[table].shift()) });
}

describe("getWccDashboardSummary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(false);
  });

  it("returns a safe empty summary without Supabase", async () => {
    const { getWccDashboardSummary } = await import("@/lib/wcc-dashboard");
    await expect(getWccDashboardSummary()).resolves.toMatchObject({
      isSupabaseConfigured: false,
      isConfiguredButUnavailable: false,
      openEscalations: 0,
      recentConversationCount: 0,
      recentContactCount: 0,
      pendingMessageCount: 0,
      failedMessageCount: 0,
      knowledgeByStatus: { draft: 0, approved: 0, archived: 0 },
      recentConversations: [],
      recentContacts: [],
      observability: expect.objectContaining({ metrics: expect.objectContaining({ totalEvents: 0 }) }),
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("includes process-local WhatsApp AI observability safely", async () => {
    const observability = await import("@/lib/observability/whatsapp-ai");
    observability.resetWhatsAppAiObservabilityForTests();
    observability.recordWhatsAppAiEvent({
      type: "send.finished",
      outcome: "failure",
      diagnostics: { error: "Bearer token failed for +5215551234567" },
    });

    const { getWccDashboardSummary } = await import("@/lib/wcc-dashboard");
    const summary = await getWccDashboardSummary();

    expect(summary.observability.metrics.sendFailures).toBe(1);
    expect(summary.observability.recentFailures).toHaveLength(1);
    expect(JSON.stringify(summary.observability)).not.toContain("5215551234567");
    expect(JSON.stringify(summary.observability)).not.toContain("Bearer token");
  });

  it("maps Supabase counts and recent rows", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    mockDb({
      whatsapp_escalations: [query({ count: 3, error: null })],
      whatsapp_conversations: [query({ count: 7, error: null }), query({ data: [{ id: "cv1", status: "awaiting_agent", last_intent: "existing_trip", last_message_at: "2026-08-28T20:00:00.000Z" }], error: null })],
      whatsapp_contacts: [query({ count: 4, error: null }), query({ data: [{ id: "ct1", display_name: "Jane", phone_e164: "+52155", last_message_at: "2026-08-28T19:00:00.000Z" }], error: null })],
      whatsapp_messages: [query({ count: 2, error: null }), query({ count: 1, error: null })],
      whatsapp_knowledge_entries: [query({ count: 5, error: null }), query({ count: 6, error: null }), query({ count: 1, error: null })],
    });
    const { getWccDashboardSummary } = await import("@/lib/wcc-dashboard");
    await expect(getWccDashboardSummary()).resolves.toMatchObject({
      openEscalations: 3,
      recentConversationCount: 7,
      recentContactCount: 4,
      pendingMessageCount: 2,
      failedMessageCount: 1,
      knowledgeByStatus: { draft: 5, approved: 6, archived: 1 },
      recentConversations: [{ id: "cv1", status: "awaiting_agent", lastIntent: "existing_trip" }],
      recentContacts: [{ id: "ct1", displayName: "Jane", phoneE164: "+52155" }],
    });
  });

  it("falls back safely when configured Supabase reads fail", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    createClient.mockResolvedValue({ from: vi.fn(() => query({ error: { message: "relation does not exist" } })) });
    const { getWccDashboardSummary } = await import("@/lib/wcc-dashboard");
    await expect(getWccDashboardSummary()).resolves.toMatchObject({
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: true,
      openEscalations: 0,
      recentConversations: [],
    });
  });

  it("keeps successful metrics when one WhatsApp read fails", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    mockDb({
      whatsapp_escalations: [query({ count: 2, error: null })],
      whatsapp_conversations: [
        query({ count: 8, error: null }),
        query({ data: [{ id: "cv1", status: "open", last_intent: "support", last_message_at: null }], error: null }),
      ],
      whatsapp_messages: [query({ count: 3, error: null }), query({ count: 1, error: null })],
      whatsapp_knowledge_entries: [query({ count: 4, error: null }), query({ count: 5, error: null }), query({ count: 0, error: null })],
    });
    const { getWccDashboardSummary } = await import("@/lib/wcc-dashboard");
    await expect(getWccDashboardSummary()).resolves.toMatchObject({
      isConfiguredButUnavailable: true,
      openEscalations: 2,
      recentConversationCount: 8,
      recentContactCount: 0,
      pendingMessageCount: 3,
      recentConversations: [{ id: "cv1", lastIntent: "support" }],
    });
  });
});

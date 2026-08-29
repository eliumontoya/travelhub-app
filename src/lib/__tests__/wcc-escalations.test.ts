import { beforeEach, describe, expect, it, vi } from "vitest";

const isSupabaseConfigured = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured, createClient }));

type Result = { data?: unknown[] | null; error?: { message: string } | null; count?: number | null };
function query(result: Result) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(() => q),
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return q;
}

function mockDb(tables: Record<string, ReturnType<typeof query>[]>) {
  createClient.mockResolvedValue({ from: vi.fn((table: string) => tables[table].shift()) });
}

const escalationRow = {
  id: "es1",
  conversation_id: "cv1",
  contact_id: "ct1",
  message_id: "msg1",
  intent_id: "in1",
  reason: "traveler needs urgent support",
  priority: "urgent",
  status: "open",
  summary: "Vuelo cancelado",
  assigned_to: "Eliu",
  opened_at: "2026-08-28T10:00:00.000Z",
  resolved_at: null,
  created_at: "2026-08-28T10:00:00.000Z",
  updated_at: "2026-08-28T10:00:00.000Z",
};

describe("getWccEscalationsQueue", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(false);
  });

  it("returns a safe empty queue without Supabase", async () => {
    const { getWccEscalationsQueue } = await import("@/lib/wcc-escalations");
    await expect(getWccEscalationsQueue()).resolves.toMatchObject({
      isSupabaseConfigured: false,
      isConfiguredButUnavailable: false,
      escalations: [],
      page: 1,
      totalCount: 0,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("maps escalations with batched contact and conversation context", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    mockDb({
      whatsapp_escalations: [query({ data: [escalationRow], count: 21, error: null })],
      whatsapp_contacts: [query({ data: [{ id: "ct1", phone_e164: "+52155", whatsapp_profile_name: "Jane WA", display_name: "Jane", linked_client_id: "cl1" }], error: null })],
      whatsapp_conversations: [query({ data: [{ id: "cv1", status: "escalated", last_intent: "support", last_message_at: "2026-08-28T09:59:00.000Z", assigned_trip_id: "trip1" }], error: null })],
    });

    const { getWccEscalationsQueue } = await import("@/lib/wcc-escalations");
    const result = await getWccEscalationsQueue({ page: 2, status: "open", priority: "urgent" });

    expect(result).toMatchObject({
      isSupabaseConfigured: true,
      totalCount: 21,
      totalPages: 2,
      page: 2,
      status: "open",
      priority: "urgent",
      escalations: [{ id: "es1", summary: "Vuelo cancelado", contact: { displayName: "Jane" }, conversation: { status: "escalated" } }],
    });
  });

  it("applies only allowlisted filters", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const escalationsQuery = query({ data: [], count: 0, error: null });
    mockDb({ whatsapp_escalations: [escalationsQuery] });

    const { getWccEscalationsQueue } = await import("@/lib/wcc-escalations");
    await getWccEscalationsQueue({ status: "deleted", priority: "urgent" });

    expect(escalationsQuery.eq).toHaveBeenCalledTimes(1);
    expect(escalationsQuery.eq).toHaveBeenCalledWith("priority", "urgent");
  });

  it("falls back safely when configured Supabase queue reads fail", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    createClient.mockResolvedValue({ from: vi.fn(() => query({ error: { message: "relation does not exist" } })) });

    const { getWccEscalationsQueue } = await import("@/lib/wcc-escalations");
    await expect(getWccEscalationsQueue()).resolves.toMatchObject({
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: true,
      escalations: [],
    });
  });
});

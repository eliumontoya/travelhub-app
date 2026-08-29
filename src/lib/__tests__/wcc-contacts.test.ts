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

const contactRow = {
  id: "ct1",
  phone_e164: "+5215512345678",
  whatsapp_profile_name: "Jane WA",
  display_name: "Jane",
  linked_client_id: "cl1",
  opt_in_status: "opted_in",
  first_seen_at: "2026-08-20T10:00:00.000Z",
  last_seen_at: "2026-08-28T10:00:00.000Z",
  last_message_at: "2026-08-28T10:00:00.000Z",
  created_at: "2026-08-20T10:00:00.000Z",
};

const clientRow = {
  id: "cl1",
  name: "Jane Traveler",
  email: "jane@example.com",
  phone: "+5215512345678",
  whatsapp: "+5215512345678",
};

describe("getWccContactsList", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(false);
  });

  it("returns a safe empty list without Supabase", async () => {
    const { getWccContactsList } = await import("@/lib/wcc-contacts");
    await expect(getWccContactsList()).resolves.toMatchObject({
      isSupabaseConfigured: false,
      isConfiguredButUnavailable: false,
      contacts: [],
      page: 1,
      totalCount: 0,
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("maps Supabase contact rows with linked clients and pagination", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    mockDb({
      whatsapp_contacts: [query({ data: [contactRow], count: 21, error: null })],
      clients: [query({ data: [clientRow], error: null })],
    });

    const { getWccContactsList } = await import("@/lib/wcc-contacts");
    const result = await getWccContactsList(2);

    expect(result).toMatchObject({
      isSupabaseConfigured: true,
      totalCount: 21,
      totalPages: 2,
      page: 2,
      contacts: [{ id: "ct1", displayName: "Jane", linkedClient: { name: "Jane Traveler" } }],
    });
  });

  it("falls back safely when configured Supabase list reads fail", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    createClient.mockResolvedValue({ from: vi.fn(() => query({ error: { message: "relation does not exist" } })) });

    const { getWccContactsList } = await import("@/lib/wcc-contacts");
    await expect(getWccContactsList()).resolves.toMatchObject({
      isSupabaseConfigured: true,
      isConfiguredButUnavailable: true,
      contacts: [],
    });
  });
});

describe("getWccContactDetail", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(true);
  });

  it("maps contact detail context without mutations", async () => {
    mockDb({
      whatsapp_contacts: [query({}, { data: contactRow, error: null })],
      clients: [query({ data: [clientRow], error: null })],
      whatsapp_conversations: [query({ data: [{ id: "cv1", status: "open", last_intent: "support", last_message_at: "2026-08-28T10:00:00.000Z" }], error: null })],
      whatsapp_escalations: [query({ data: [{ id: "es1", reason: "needs help", priority: "high", status: "open", summary: "Ayuda humana", opened_at: "2026-08-28T10:01:00.000Z" }], error: null })],
      whatsapp_intents: [query({ data: [{ id: "in1", intent_type: "support", confidence: 0.82, summary: "Pregunta", status: "detected", detected_at: "2026-08-28T10:02:00.000Z" }], error: null })],
    });

    const { getWccContactDetail } = await import("@/lib/wcc-contacts");
    await expect(getWccContactDetail("ct1")).resolves.toMatchObject({
      contact: { id: "ct1", linkedClient: { id: "cl1" } },
      conversations: [{ id: "cv1", status: "open" }],
      escalations: [{ id: "es1", priority: "high" }],
      intents: [{ id: "in1", intentType: "support", confidence: 0.82 }],
    });
  });
});

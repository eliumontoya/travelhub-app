import { beforeEach, describe, expect, it, vi } from "vitest";

const isSupabaseConfigured = vi.fn();
const createClient = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ isSupabaseConfigured, createClient }));

type Result = { data?: unknown; error?: { message: string } | null; count?: number | null };
function query(result: Result = { data: [], error: null }) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    order: vi.fn(() => q),
    range: vi.fn(async () => result),
    insert: vi.fn(() => q),
    update: vi.fn(() => q),
    maybeSingle: vi.fn(async () => ({ data: Array.isArray(result.data) ? result.data[0] : result.data, error: result.error ?? null })),
    single: vi.fn(async () => ({ data: Array.isArray(result.data) ? result.data[0] : result.data, error: result.error ?? null })),
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve),
  };
  return q;
}

function mockDb(tables: Record<string, ReturnType<typeof query>[]>) {
  const from = vi.fn((table: string) => {
    const next = tables[table]?.shift();
    if (!next) throw new Error(`Unexpected table ${table}`);
    return next;
  });
  createClient.mockResolvedValue({ from });
  return { from };
}

describe("wcc knowledge helper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-29T10:00:00.000Z"));
    vi.resetModules();
    vi.clearAllMocks();
    isSupabaseConfigured.mockReturnValue(false);
  });

  it("returns safe empty list without Supabase", async () => {
    const { getWccKnowledgeList } = await import("@/lib/wcc-knowledge");
    await expect(getWccKnowledgeList({ page: "2", status: "approved" })).resolves.toMatchObject({
      isSupabaseConfigured: false,
      isConfiguredButUnavailable: false,
      entries: [],
      page: 2,
      status: "approved",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("allowlists status filters and maps rows", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const listQuery = query({
      count: 1,
      error: null,
      data: [{
        id: "k1",
        topic: "Visas",
        question: "¿Necesito visa?",
        answer: "Depende del destino.",
        tags: ["visa", "docs"],
        source: "manual",
        status: "approved",
        approved_at: "2026-08-29T09:00:00.000Z",
        created_at: "2026-08-28T09:00:00.000Z",
        updated_at: "2026-08-29T09:00:00.000Z",
      }],
    });
    mockDb({ whatsapp_knowledge_entries: [listQuery] });

    const { getWccKnowledgeList } = await import("@/lib/wcc-knowledge");
    const result = await getWccKnowledgeList({ status: "approved" });

    expect(listQuery.eq).toHaveBeenCalledWith("status", "approved");
    expect(result.entries[0]).toMatchObject({ id: "k1", topic: "Visas", tags: ["visa", "docs"], status: "approved", approvedAt: "2026-08-29T09:00:00.000Z" });
  });

  it("ignores unsupported status filters before querying", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const listQuery = query({ count: 0, error: null, data: [] });
    mockDb({ whatsapp_knowledge_entries: [listQuery] });

    const { getWccKnowledgeList } = await import("@/lib/wcc-knowledge");
    const result = await getWccKnowledgeList({ status: "deleted" });

    expect(listQuery.eq).not.toHaveBeenCalled();
    expect(result.status).toBeUndefined();
  });

  it("normalizes valid input and sets approved timestamp only for approved status", async () => {
    const { validateWccKnowledgeInput } = await import("@/lib/wcc-knowledge");
    expect(validateWccKnowledgeInput({ topic: " Visas ", question: " Q ", answer: " A ", tags: "visa, docs, visa", source: " manual ", status: "approved" })).toEqual({
      topic: "Visas",
      question: "Q",
      answer: "A",
      tags: ["visa", "docs"],
      source: "manual",
      status: "approved",
      approved_at: "2026-08-29T10:00:00.000Z",
    });
    expect(validateWccKnowledgeInput({ topic: "T", question: "Q", answer: "A", status: "archived" }).approved_at).toBeNull();
  });

  it("rejects invalid input before writes", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const { createWccKnowledgeEntry } = await import("@/lib/wcc-knowledge");
    const result = await createWccKnowledgeEntry({ topic: "", question: "", answer: "", status: "approved" });
    expect(result).toMatchObject({ ok: false, errors: { topic: "El tema es obligatorio.", question: "La pregunta es obligatoria.", answer: "La respuesta es obligatoria." } });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("creates entries with validated payload", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const createQuery = query({ data: { id: "k1" }, error: null });
    mockDb({ whatsapp_knowledge_entries: [createQuery] });

    const { createWccKnowledgeEntry } = await import("@/lib/wcc-knowledge");
    const result = await createWccKnowledgeEntry({ topic: "Visas", question: "Q", answer: "A", tags: "visa", status: "approved" });

    expect(createQuery.insert).toHaveBeenCalledWith(expect.objectContaining({ topic: "Visas", tags: ["visa"], status: "approved", approved_at: "2026-08-29T10:00:00.000Z" }));
    expect(result).toMatchObject({ ok: true, entryId: "k1" });
  });

  it("updates status with allowlisted lifecycle values", async () => {
    isSupabaseConfigured.mockReturnValue(true);
    const updateQuery = query({ data: { id: "k1" }, error: null });
    mockDb({ whatsapp_knowledge_entries: [updateQuery] });

    const { updateWccKnowledgeStatus } = await import("@/lib/wcc-knowledge");
    const result = await updateWccKnowledgeStatus("k1", "archived");

    expect(updateQuery.update).toHaveBeenCalledWith({ status: "archived", approved_at: null });
    expect(updateQuery.eq).toHaveBeenCalledWith("id", "k1");
    expect(result.ok).toBe(true);
  });
});

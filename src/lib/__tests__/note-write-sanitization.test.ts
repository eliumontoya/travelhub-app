import { beforeEach, describe, it, expect, vi } from "vitest";

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of the data modules runs. We assert that the notes written
 * through `insert()` are sanitized before they ever reach the database — this
 * was previously proven through the now-deleted mock branch.
 */
const db = vi.hoisted(() => {
  type Call = { table: string; method: string; args: unknown[] };

  const calls: Call[] = [];
  const rows = new Map<string, Record<string, unknown>[]>();

  function createBuilder(table: string) {
    let payload: Record<string, unknown> = {};

    const builder = {
      insert(next: Record<string, unknown>) {
        calls.push({ table, method: "insert", args: [next] });
        payload = next;
        return builder;
      },
      select(...args: unknown[]) {
        calls.push({ table, method: "select", args });
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table, method: "eq", args });
        return builder;
      },
      async single() {
        calls.push({ table, method: "single", args: [] });
        const row: Record<string, unknown> = {
          id: `${table}-1`,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          ...payload,
        };
        const tableRows = rows.get(table) ?? [];
        tableRows.push(row);
        rows.set(table, tableRows);
        return { data: row, error: null };
      },
      async maybeSingle() {
        calls.push({ table, method: "maybeSingle", args: [] });
        return { data: rows.get(table)?.[0] ?? null, error: null };
      },
      then(resolve: (value: { data: null; error: null }) => unknown) {
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
    };
    return builder;
  }

  const client = { from: (table: string) => createBuilder(table) };

  return {
    calls,
    client,
    reset() {
      calls.length = 0;
      rows.clear();
    },
    inserted(table: string) {
      return calls
        .filter((call) => call.table === table && call.method === "insert")
        .map((call) => call.args[0] as Record<string, unknown>);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => db.client,
  getSupabaseAdmin: () => db.client,
}));

import { createClient, createItem, createSupplier, createTripDay } from "@/lib/data";

beforeEach(() => db.reset());

describe("note writes are sanitized (Supabase contract)", () => {
  it("createClient strips <script> from the inserted notes", async () => {
    const client = await createClient({
      name: "Cliente XSS",
      notes: "<p>ok</p><script>alert(1)</script>",
    });

    const inserted = db.inserted("clients").at(-1);
    expect(String(inserted?.notes)).not.toContain("<script");
    expect(String(inserted?.notes)).toContain("ok");
    expect(client.notes).not.toContain("<script");
    expect(client.notes).toContain("ok");
  });

  it("createSupplier strips <script> from the inserted notes", async () => {
    const supplier = await createSupplier({
      name: "Proveedor XSS",
      type: "actividad",
      notes: "<script>alert(1)</script><strong>ok</strong>",
    });

    const inserted = db.inserted("suppliers").at(-1);
    expect(String(inserted?.notes)).not.toContain("<script");
    expect(String(inserted?.notes)).toContain("ok");
    expect(supplier.notes).not.toContain("<script");
    expect(supplier.notes).toContain("ok");
  });

  it("createItem strips <script> from the inserted notes", async () => {
    const day = await createTripDay({ tripId: "trip-xss", date: "2030-01-01" });
    const item = await createItem({
      tripDayId: day.id,
      type: "note",
      title: "Item XSS",
      notes: "<script>alert(1)</script>",
    });

    const inserted = db.inserted("items").at(-1);
    expect(String(inserted?.notes)).not.toContain("<script");
    expect(item.notes).not.toContain("<script");
  });
});

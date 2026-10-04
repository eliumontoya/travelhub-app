import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/clients.ts` + `documents.ts` runs. We
 * assert the query shapes and the client row mapping.
 */
const state = vi.hoisted(() => {
  interface Call {
    table: string;
    method: string;
    args: unknown[];
  }

  const calls: Call[] = [];
  let clientRow: Record<string, unknown> | null = null;

  function baseClient(): Record<string, unknown> {
    return {
      id: "client-1",
      name: "Cliente Cover",
      slug: "cliente-cover-abc",
      email: "",
      phone: "",
      whatsapp: "",
      notes: null,
      referral_source: null,
      birth_date: null,
      cover_image_url: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
  }

  function createBuilder() {
    const builder = {
      select(...args: unknown[]) {
        calls.push({ table: "clients", method: "select", args });
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table: "clients", method: "eq", args });
        return builder;
      },
      insert(...args: unknown[]) {
        calls.push({ table: "clients", method: "insert", args });
        const input = args[0] as Record<string, unknown>;
        clientRow = {
          ...baseClient(),
          ...input,
          id: "client-1",
        };
        return builder;
      },
      update(...args: unknown[]) {
        calls.push({ table: "clients", method: "update", args });
        const patch = args[0] as Record<string, unknown>;
        clientRow = { ...(clientRow ?? baseClient()), ...patch };
        return builder;
      },
      async maybeSingle() {
        calls.push({ table: "clients", method: "maybeSingle", args: [] });
        return { data: clientRow, error: null };
      },
      async single() {
        calls.push({ table: "clients", method: "single", args: [] });
        return { data: clientRow, error: null };
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: clientRow, error: null }).then(resolve);
      },
    };
    return builder;
  }

  const client = { from: () => createBuilder() };

  return {
    calls,
    client,
    baseClient,
    reset() {
      calls.length = 0;
      clientRow = null;
    },
    setRow(row: Record<string, unknown> | null) {
      clientRow = row;
    },
    getRow() {
      return clientRow;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
}));

import {
  createClient,
  updateClient,
  removeClientCoverImage,
  getClientById,
} from "@/lib/data";

beforeEach(() => state.reset());

describe("client cover image (Supabase contract)", () => {
  it("createClient inserts the row (with generated slug) and maps it back", async () => {
    const client = await createClient({ name: "Cliente Cover" });

    const insertCall = state.calls.find((call) => call.method === "insert");
    const inserted = insertCall?.args[0] as Record<string, unknown>;
    expect(inserted).toMatchObject({ name: "Cliente Cover" });
    expect(String(inserted.slug)).toMatch(/^cliente-cover-/);
    expect(client.id).toBe("client-1");
    expect(client.name).toBe("Cliente Cover");
  });

  it("persists the cover image URL via update('cover_image_url') and maps it back", async () => {
    state.setRow(state.baseClient());
    const url = "https://example.com/covers/c.jpg";

    const updated = await updateClient("client-1", { coverImageUrl: url });

    const updateCall = state.calls.find((call) => call.method === "update");
    expect(updateCall?.args).toEqual([{ cover_image_url: url }]);
    expect(state.calls.some((call) => call.method === "eq" && call.args[0] === "id")).toBe(true);
    expect(updated.coverImageUrl).toBe(url);
  });

  it("reads cover_image_url through select('*').eq('id').maybeSingle()", async () => {
    state.setRow({ ...state.baseClient(), cover_image_url: "https://example.com/covers/c.jpg" });

    const found = await getClientById("client-1");

    expect(state.calls).toEqual([
      { table: "clients", method: "select", args: ["*"] },
      { table: "clients", method: "eq", args: ["id", "client-1"] },
      { table: "clients", method: "maybeSingle", args: [] },
    ]);
    expect(found?.coverImageUrl).toBe("https://example.com/covers/c.jpg");
  });

  it("round-trips create → update cover → read", async () => {
    const url = "https://example.com/covers/c.jpg";
    const client = await createClient({ name: "Cliente Cover" });

    const updated = await updateClient(client.id, { coverImageUrl: url });
    expect(updated.coverImageUrl).toBe(url);

    state.calls.length = 0;
    const fetched = await getClientById(client.id);
    expect(fetched!.coverImageUrl).toBe(url);
  });

  it("removeClientCoverImage nulls cover_image_url", async () => {
    state.setRow({ ...state.baseClient(), cover_image_url: "https://example.com/covers/c.jpg" });

    await removeClientCoverImage("client-1");

    expect(state.calls).toEqual([
      { table: "clients", method: "update", args: [{ cover_image_url: null }] },
      { table: "clients", method: "eq", args: ["id", "client-1"] },
    ]);
    expect(state.getRow()?.cover_image_url).toBeNull();
  });

  it("clears the cover image URL on remove", async () => {
    const url = "https://example.com/covers/c.jpg";
    const client = await createClient({ name: "Cliente Cover 2" });
    await updateClient(client.id, { coverImageUrl: url });

    await removeClientCoverImage(client.id);

    const after = await getClientById(client.id);
    expect(after!.coverImageUrl).toBeUndefined();
  });
});

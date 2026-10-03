import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/clients.ts` runs. We assert the
 * `clients.pin_hash` update/verify call shapes; bcrypt hashing itself stays a
 * pure unit under test.
 */
const state = vi.hoisted(() => {
  type ClientRow = { id: string; email: string; pin_hash: string | null };
  type Call = { table: string; method: string; args: unknown[] };

  const clients: ClientRow[] = [];
  const calls: Call[] = [];

  function createBuilder(table: string) {
    let mode: "select" | "update" = "select";
    let payload: Record<string, unknown> = {};
    const filters: [string, unknown][] = [];

    const matches = (row: ClientRow) =>
      filters.every(([col, value]) => (row as unknown as Record<string, unknown>)[col] === value);

    const builder = {
      select(...args: unknown[]) {
        calls.push({ table, method: "select", args });
        mode = "select";
        return builder;
      },
      update(next: Record<string, unknown>) {
        calls.push({ table, method: "update", args: [next] });
        mode = "update";
        payload = next;
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table, method: "eq", args });
        filters.push([args[0] as string, args[1]]);
        return builder;
      },
      async maybeSingle() {
        calls.push({ table, method: "maybeSingle", args: [] });
        return { data: clients.find(matches) ?? null, error: null };
      },
      then(resolve: (value: { data: null; error: null }) => unknown) {
        calls.push({ table, method: "await", args: [] });
        if (mode === "update") {
          for (const row of clients.filter(matches)) {
            Object.assign(row, payload);
          }
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
    };
    return builder;
  }

  const client = { from: (table: string) => createBuilder(table) };

  return {
    calls,
    client,
    clients,
    reset() {
      clients.length = 0;
      calls.length = 0;
    },
    callsFor(table: string, method: string) {
      return calls.filter((call) => call.table === table && call.method === method);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
  getSupabaseAdmin: () => state.client,
}));

import {
  getClientPinHashByEmail,
  hasClientPin,
  rowToClient,
  setClientPin,
} from "@/lib/data/clients";

beforeEach(() => {
  state.reset();
  state.clients.push({ id: "c1", email: "ana.perez@example.com", pin_hash: null });
});

describe("client PIN data layer (Supabase contract)", () => {
  it("persists a bcrypt hash (not plaintext) through a pin_hash update by id", async () => {
    await setClientPin("c1", "123456");

    const update = state.callsFor("clients", "update").at(-1);
    const hash = (update?.args[0] as Record<string, unknown>).pin_hash as string;
    expect(hash).not.toBe("123456");
    expect(await bcrypt.compare("123456", hash)).toBe(true);
    expect(state.callsFor("clients", "eq")).toContainEqual(
      expect.objectContaining({ args: ["id", "c1"] })
    );
    expect(state.clients[0].pin_hash).toBe(hash);
  });

  it("verifies the stored hash by normalized email", async () => {
    await setClientPin("c1", "123456");
    state.calls.length = 0;

    const hash = await getClientPinHashByEmail("  ANA.PEREZ@example.com ");

    expect(hash).not.toBeNull();
    expect(await bcrypt.compare("123456", hash!)).toBe(true);
    expect(state.callsFor("clients", "select")[0].args).toEqual(["pin_hash"]);
    expect(state.callsFor("clients", "eq")[0].args).toEqual(["email", "ana.perez@example.com"]);
  });

  it("rotates the PIN so the old one no longer validates", async () => {
    await setClientPin("c1", "oldpin");
    const firstHash = await getClientPinHashByEmail("ana.perez@example.com");

    await setClientPin("c1", "newpin");
    const secondHash = await getClientPinHashByEmail("ana.perez@example.com");

    expect(secondHash).not.toBe(firstHash);
    expect(await bcrypt.compare("oldpin", secondHash!)).toBe(false);
    expect(await bcrypt.compare("newpin", secondHash!)).toBe(true);
  });

  it("returns null for an unknown email", async () => {
    await expect(getClientPinHashByEmail("missing@example.com")).resolves.toBeNull();
  });

  it("reports whether a client has a PIN by reading pin_hash for that id", async () => {
    await expect(hasClientPin("c1")).resolves.toBe(false);

    await setClientPin("c1", "123456");

    await expect(hasClientPin("c1")).resolves.toBe(true);
    expect(state.callsFor("clients", "eq").at(-1)?.args).toEqual(["id", "c1"]);
  });

  it("never exposes pin_hash through rowToClient", () => {
    const row = {
      id: "c1",
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      created_at: "2026-01-01T00:00:00Z",
      pin_hash: "$2a$10$hashedvalue",
    };

    const client = rowToClient(row);

    expect(client).not.toHaveProperty("pin_hash");
    expect(client).not.toHaveProperty("pin");
    expect((client as unknown as Record<string, unknown>).pin_hash).toBeUndefined();
  });
});

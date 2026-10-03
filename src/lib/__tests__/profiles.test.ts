import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature } from "@/types";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/profiles.ts` runs. We assert the
 * `profiles` read/write query shapes and the row mapping.
 *
 * This file only covers `data/profiles.ts`. Account resolution in
 * `src/lib/auth/roles.ts` (currentMockAccountId / setCurrentMockAccountId) is
 * out of scope for this batch and is left for phase 5.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const errors = new Map<string, unknown>();
  let users: { id: string; email?: string }[] = [];
  const NOW = "2026-01-02T00:00:00.000Z";

  const table = (name: string): Row[] => {
    let rows = tables.get(name);
    if (!rows) {
      rows = [];
      tables.set(name, rows);
    }
    return rows;
  };

  const matches = (row: Row, filters: Filter[]): boolean =>
    filters.every((filter) => {
      if (filter.op === "eq") return row[filter.col] === filter.value;
      if (filter.op === "is") return (row[filter.col] ?? null) === filter.value;
      return (filter.value as unknown[]).includes(row[filter.col]);
    });

  const project = (row: Row, cols: string): Row => {
    if (cols.trim() === "*") return { ...row };
    const out: Row = {};
    for (const key of cols.split(",").map((c) => c.trim())) out[key] = row[key];
    return out;
  };

  class Query {
    private filters: Filter[] = [];
    private orders: { col: string; asc: boolean }[] = [];
    private op: "select" | "update" = "select";
    private payload: Record<string, unknown> = {};
    private selectCols = "*";

    constructor(private tableName: string) {}

    select(cols = "*"): this {
      calls.push({ table: this.tableName, method: "select", args: [cols] });
      if (this.op === "select") this.selectCols = cols;
      return this;
    }
    update(payload: Record<string, unknown>): this {
      calls.push({ table: this.tableName, method: "update", args: [payload] });
      this.op = "update";
      this.payload = payload;
      return this;
    }
    eq(...args: unknown[]): this {
      calls.push({ table: this.tableName, method: "eq", args });
      this.filters.push({ col: args[0] as string, value: args[1], op: "eq" });
      return this;
    }
    in(...args: unknown[]): this {
      calls.push({ table: this.tableName, method: "in", args });
      this.filters.push({ col: args[0] as string, value: args[1], op: "in" });
      return this;
    }
    is(...args: unknown[]): this {
      calls.push({ table: this.tableName, method: "is", args });
      this.filters.push({ col: args[0] as string, value: args[1], op: "is" });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }): this {
      calls.push({ table: this.tableName, method: "order", args: opts === undefined ? [col] : [col, opts] });
      this.orders.push({ col, asc: opts?.ascending ?? true });
      return this;
    }

    private runSelect(): Row[] {
      let rows = table(this.tableName).filter((row) => matches(row, this.filters));
      for (const { col, asc } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
          return asc ? cmp : -cmp;
        });
      }
      return rows.map((row) => project(row, this.selectCols));
    }

    private runWrite(): Row[] {
      const rows = table(this.tableName);
      const matched = rows.filter((row) => matches(row, this.filters));
      for (const row of matched) Object.assign(row, { updated_at: NOW, ...this.payload });
      return matched;
    }

    async single() {
      calls.push({ table: this.tableName, method: "single", args: [] });
      const error = errors.get(this.tableName) ?? null;
      if (error) return { data: null, error };
      if (this.op === "select") return { data: this.runSelect()[0] ?? null, error: null };
      return { data: this.runWrite()[0] ?? null, error: null };
    }

    then<TResult1, TResult2 = never>(
      onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      const error = errors.get(this.tableName) ?? null;
      if (error) return Promise.resolve({ data: null, error }).then(onfulfilled, onrejected);
      const data = this.op === "select" ? this.runSelect() : this.runWrite();
      return Promise.resolve({ data, error: null }).then(onfulfilled, onrejected);
    }
  }

  const client = {
    from: (name: string) => new Query(name),
    auth: { admin: { listUsers: async () => ({ data: { users } }) } },
  };

  return {
    calls,
    client,
    table,
    reset() {
      tables.clear();
      calls.length = 0;
      errors.clear();
      users = [];
    },
    setError(tableName: string, error: unknown) {
      errors.set(tableName, error);
    },
    setUsers(next: { id: string; email?: string }[]) {
      users = next;
    },
    callsFor(tableName: string, method: string) {
      return calls.filter((call) => call.table === tableName && call.method === method);
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => db.client,
  getSupabaseAdmin: () => db.client,
}));

import { listProfiles, updateProfileFeatures, rowToProfile } from "@/lib/data/profiles";
import { filterFeatures } from "@/lib/auth/features";

beforeEach(() => db.reset());

describe("profiles data layer", () => {
  describe("rowToProfile", () => {
    it("maps a profiles row to AccountProfile", () => {
      const row = {
        id: "user-1",
        role: "agent",
        features: ["trips", "clients"],
        travel_agent_id: "a1",
      };
      expect(rowToProfile(row)).toEqual({
        id: "user-1",
        role: "agent",
        features: ["trips", "clients"],
        travelAgentId: "a1",
      });
    });

    it("drops unknown feature strings defensively", () => {
      const row = {
        id: "user-2",
        role: "agent",
        features: ["trips", "bogus", "clients"],
        travel_agent_id: null,
      };
      expect(rowToProfile(row).features).toEqual(["trips", "clients"]);
    });

    it("treats a missing travel_agent_id as undefined", () => {
      const row = {
        id: "user-3",
        role: "admin",
        features: [],
        travel_agent_id: null,
      };
      expect(rowToProfile(row).travelAgentId).toBeUndefined();
    });
  });

  describe("listProfiles (Supabase contract)", () => {
    it("queries the profiles table ordered by created_at and resolves email + agent name", async () => {
      db.table("profiles").push(
        {
          id: "u1",
          role: "admin",
          features: [],
          travel_agent_id: null,
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "u2",
          role: "agent",
          features: ["trips"],
          travel_agent_id: "a1",
          created_at: "2026-01-02T00:00:00Z",
        }
      );
      db.table("travel_agents").push({ id: "a1", name: "Agencia Uno" });
      db.setUsers([
        { id: "u1", email: "admin@example.com" },
        { id: "u2", email: "agent@example.com" },
      ]);

      const profiles = await listProfiles();

      expect(profiles).toEqual([
        {
          id: "u1",
          role: "admin",
          features: [],
          travelAgentId: undefined,
          email: "admin@example.com",
          travelAgentName: undefined,
        },
        {
          id: "u2",
          role: "agent",
          features: ["trips"],
          travelAgentId: "a1",
          email: "agent@example.com",
          travelAgentName: "Agencia Uno",
        },
      ]);

      expect(db.callsFor("profiles", "select")[0].args).toEqual([
        "id, role, features, travel_agent_id",
      ]);
      expect(db.callsFor("profiles", "order")[0].args).toEqual(["created_at"]);
      expect(db.callsFor("travel_agents", "select")[0].args).toEqual(["id, name"]);
      expect(db.callsFor("travel_agents", "in")[0].args).toEqual(["id", ["a1"]]);
    });

    it("returns an empty array when no profiles exist (and skips the agent lookup)", async () => {
      expect(await listProfiles()).toEqual([]);
      expect(db.callsFor("travel_agents", "select")).toHaveLength(0);
    });

    it("throws when supabase returns an error", async () => {
      db.setError("profiles", { message: "boom" });

      await expect(listProfiles()).rejects.toBeDefined();
    });
  });

  describe("updateProfileFeatures (Supabase contract)", () => {
    beforeEach(() => {
      db.table("profiles").push({
        id: "u2",
        role: "agent",
        features: ["trips", "clients"],
        travel_agent_id: "a1",
      });
    });

    it("updates sanitized features + updated_at, filtered by id, then re-selects the row", async () => {
      const result = await updateProfileFeatures("u2", ["trips", "clients"]);

      const update = db.callsFor("profiles", "update").at(-1);
      const patch = update?.args[0] as Record<string, unknown>;
      expect(patch.features).toEqual(["trips", "clients"]);
      expect(typeof patch.updated_at).toBe("string");
      expect(db.callsFor("profiles", "eq").at(-1)?.args).toEqual(["id", "u2"]);
      expect(db.callsFor("profiles", "select").at(-1)?.args).toEqual([
        "id, role, features, travel_agent_id",
      ]);
      expect(db.callsFor("profiles", "single")).toHaveLength(1);
      expect(result).toEqual({
        id: "u2",
        role: "agent",
        features: ["trips", "clients"],
        travelAgentId: "a1",
      });
    });

    it("strips unknown feature strings before sending the update", async () => {
      await updateProfileFeatures("u2", ["trips", "bogus", "another-bad"] as Feature[]);

      expect(db.callsFor("profiles", "update").at(-1)?.args[0]).toMatchObject({
        features: ["trips"],
      });
      expect(filterFeatures(["trips", "bogus", "another-bad"])).toEqual(["trips"]);
    });

    it("clears all features when the input is empty", async () => {
      const updated = await updateProfileFeatures("u2", []);

      expect(updated.features).toEqual([]);
      expect(db.callsFor("profiles", "update").at(-1)?.args[0]).toMatchObject({ features: [] });
    });

    it("a subsequent listProfiles reflects the persisted change", async () => {
      await updateProfileFeatures("u2", ["suppliers", "settings"]);

      const profiles = await listProfiles();
      const agent = profiles.find((profile) => profile.id === "u2");

      expect(agent?.features).toEqual(["suppliers", "settings"]);
    });

    it("throws when supabase returns an error", async () => {
      db.setError("profiles", { message: "boom" });

      await expect(updateProfileFeatures("u2", ["trips"])).rejects.toBeDefined();
    });
  });
});

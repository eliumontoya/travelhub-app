import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase (service-role) branch of `src/lib/data/clients.ts` and
 * `src/lib/data/trip-queries.ts` runs. We assert the query shapes and the
 * whitelisted row mapping for the client home surface.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];

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

  function createBuilder(tableName: string) {
    const filters: Filter[] = [];
    const orders: { col: string; asc: boolean }[] = [];
    let selectCols = "*";

    const run = (): Row[] => {
      let rows = table(tableName).filter((row) => matches(row, filters));
      for (const { col, asc } of [...orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
          return asc ? cmp : -cmp;
        });
      }
      return rows.map((row) => project(row, selectCols));
    };

    const builder = {
      select(...args: unknown[]) {
        calls.push({ table: tableName, method: "select", args });
        selectCols = (args[0] as string) ?? "*";
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table: tableName, method: "eq", args });
        filters.push({ col: args[0] as string, value: args[1], op: "eq" });
        return builder;
      },
      in(...args: unknown[]) {
        calls.push({ table: tableName, method: "in", args });
        filters.push({ col: args[0] as string, value: args[1], op: "in" });
        return builder;
      },
      is(...args: unknown[]) {
        calls.push({ table: tableName, method: "is", args });
        filters.push({ col: args[0] as string, value: args[1], op: "is" });
        return builder;
      },
      order(...args: unknown[]) {
        calls.push({ table: tableName, method: "order", args });
        const opts = args[1] as { ascending?: boolean } | undefined;
        orders.push({ col: args[0] as string, asc: opts?.ascending ?? true });
        return builder;
      },
      async maybeSingle() {
        calls.push({ table: tableName, method: "maybeSingle", args: [] });
        return { data: run()[0] ?? null, error: null };
      },
      then(resolve: (value: { data: Row[]; error: null }) => unknown) {
        return Promise.resolve({ data: run(), error: null }).then(resolve);
      },
    };
    return builder;
  }

  const client = { from: (name: string) => createBuilder(name) };

  return {
    calls,
    client,
    table,
    reset() {
      tables.clear();
      calls.length = 0;
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

import { getClientHomeTrips, getClientProfileForHome } from "@/lib/data";

function seedClient(overrides: Record<string, unknown> = {}) {
  db.table("clients").push({
    id: "c1",
    name: "Ana y Roberto Pérez",
    slug: "ana-y-roberto-perez",
    email: "ana.perez@example.com",
    phone: "+52 55 1234 5678",
    whatsapp: "+52 55 1234 5678",
    birth_date: "1990-08-01",
    notes: "Luna de miel, prefieren hoteles boutique.",
    referral_source: null,
    cover_image_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  });
}

function seedTrip(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "t1",
    title: "Viaje",
    slug: "viaje",
    start_date: "2026-10-01",
    end_date: "2026-10-05",
    traveler_count: 2,
    status: "published",
    currency: "USD",
    is_template: false,
    show_costs_to_client: false,
    created_at: "2026-07-01T09:00:00Z",
    updated_at: "2026-07-01T09:00:00Z",
    assigned_agent_id: null,
    sale_price: null,
    ...overrides,
  };
  db.table("trips").push(row);
  return row;
}

function linkTrip(tripId: string, clientId = "c1") {
  db.table("trip_clients").push({ trip_id: tripId, client_id: clientId });
}

beforeEach(() => {
  db.reset();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
});

const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe("client home data (Supabase contract)", () => {
  describe("getClientProfileForHome", () => {
    it("reads the client row through the service role and maps only whitelisted fields", async () => {
      seedClient();

      const profile = await getClientProfileForHome("c1");

      expect(profile).toEqual({
        name: "Ana y Roberto Pérez",
        email: "ana.perez@example.com",
        phone: "+52 55 1234 5678",
        whatsapp: "+52 55 1234 5678",
        birthDate: "1990-08-01",
        notes: "Luna de miel, prefieren hoteles boutique.",
        referralSource: null,
        coverImageUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e",
      });

      const select = db.callsFor("clients", "select")[0];
      expect(select.args).toEqual(["*"]);
      expect(db.callsFor("clients", "eq")[0].args).toEqual(["id", "c1"]);
      expect(db.callsFor("clients", "maybeSingle")).toHaveLength(1);
    });

    it("omits agent-only fields from the profile", async () => {
      seedClient();

      const profile = await getClientProfileForHome("c1");

      expect(profile).not.toHaveProperty("id");
      expect(profile).not.toHaveProperty("slug");
      expect(profile).not.toHaveProperty("createdAt");
      expect(profile).not.toHaveProperty("updatedAt");
    });

    it("returns null when the client does not exist", async () => {
      await expect(getClientProfileForHome("nonexistent")).resolves.toBeNull();
    });
  });

  describe("getClientHomeTrips", () => {
    it("returns draft and published trips linked to the client", async () => {
      seedTrip({ id: "t1", status: "published" });
      seedTrip({ id: "t2", status: "draft", created_at: "2026-07-05T09:00:00Z" });
      linkTrip("t1");
      linkTrip("t2");

      const trips = await getClientHomeTrips("c1");

      expect(trips).toHaveLength(2);
      expect(trips.map((t) => t.status)).toEqual(expect.arrayContaining(["published", "draft"]));

      expect(db.callsFor("trip_clients", "select")[0].args).toEqual(["trip_id"]);
      expect(db.callsFor("trip_clients", "eq")[0].args).toEqual(["client_id", "c1"]);
      expect(db.callsFor("trips", "in")).toContainEqual(
        expect.objectContaining({ args: ["status", ["draft", "published"]] })
      );
      expect(db.callsFor("trips", "order")[0].args).toEqual([
        "created_at",
        { ascending: false },
      ]);
    });

    it("excludes archived trips through the status filter", async () => {
      seedTrip({ id: "t-archived", status: "archived" });
      linkTrip("t-archived");

      const trips = await getClientHomeTrips("c1");

      expect(trips.some((t) => t.id === "t-archived")).toBe(false);
    });

    it("keeps salePrice and resolves the assigned agent name", async () => {
      seedTrip({ id: "t-sale", status: "published", sale_price: 8500, assigned_agent_id: "a2" });
      linkTrip("t-sale");
      db.table("travel_agents").push({ id: "a2", name: "María González" });

      const trips = await getClientHomeTrips("c1");
      const published = trips.find((t) => t.id === "t-sale");

      expect(published?.salePrice).toBe(8500);
      expect(published?.assignedAgentId).toBe("a2");
      expect(published?.assignedAgentName).toBe("María González");
      expect(db.callsFor("travel_agents", "select")[0].args).toEqual(["id, name"]);
      expect(db.callsFor("travel_agents", "in")[0].args).toEqual(["id", ["a2"]]);
    });

    it("never exposes commissionRate or internalNotes", async () => {
      seedTrip({
        id: "t-agent-fields",
        status: "published",
        sale_price: 5000,
        commission_rate: 0.15,
        assigned_agent_id: "a1",
        internal_notes: "Notas internas",
      });
      linkTrip("t-agent-fields");
      db.table("travel_agents").push({ id: "a1", name: "Ana" });

      const trips = await getClientHomeTrips("c1");
      const trip = trips.find((t) => t.id === "t-agent-fields");

      expect(trip).toBeDefined();
      expect(trip?.salePrice).toBe(5000);
      expect("commissionRate" in trip!).toBe(false);
      expect("internalNotes" in trip!).toBe(false);
    });

    it("returns an empty array when the client has no trips", async () => {
      await expect(getClientHomeTrips("c3")).resolves.toEqual([]);
      // No trip query is issued when the link set is empty.
      expect(db.callsFor("trips", "select")).toHaveLength(0);
    });
  });

  describe("graceful degradation", () => {
    it("returns null and empty array when Supabase is configured but service role key is missing", async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const profile = await getClientProfileForHome("c1");
      const trips = await getClientHomeTrips("c1");

      expect(profile).toBeNull();
      expect(trips).toEqual([]);
      // No client/trip query is attempted without the service role.
      expect(db.callsFor("clients", "select")).toHaveLength(0);
      expect(db.callsFor("trip_clients", "select")).toHaveLength(0);

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });
});

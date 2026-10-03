import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/visas.ts` runs. We assert the exact
 * `.from()/.select()/.eq()/.in()/.update()/.insert()` shapes and the
 * snake_case → camelCase row mapping of the real queries.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" | "ilike" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const NOW = "2026-09-30T11:00:00.000Z";

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
      if (filter.op === "in") return (filter.value as unknown[]).includes(row[filter.col]);
      const needle = String(filter.value).replaceAll("%", "").toLowerCase();
      return String(row[filter.col] ?? "").toLowerCase().includes(needle);
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
    private rangeArgs: [number, number] | null = null;
    private limitN: number | null = null;
    private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
    private payload: unknown;
    private selectCols = "*";
    private countFlag = false;

    constructor(private tableName: string) {}

    select(cols = "*", opts?: { count?: string }): this {
      calls.push({ table: this.tableName, method: "select", args: opts === undefined ? [cols] : [cols, opts] });
      if (this.op === "select") this.selectCols = cols;
      if (opts?.count) this.countFlag = true;
      return this;
    }
    insert(payload: unknown): this {
      calls.push({ table: this.tableName, method: "insert", args: [payload] });
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    update(payload: unknown): this {
      calls.push({ table: this.tableName, method: "update", args: [payload] });
      this.op = "update";
      this.payload = payload;
      return this;
    }
    delete(): this {
      calls.push({ table: this.tableName, method: "delete", args: [] });
      this.op = "delete";
      return this;
    }
    upsert(payload: unknown, opts?: unknown): this {
      calls.push({ table: this.tableName, method: "upsert", args: [payload, opts] });
      this.op = "upsert";
      this.payload = payload;
      return this;
    }
    eq(col: string, value: unknown): this {
      calls.push({ table: this.tableName, method: "eq", args: [col, value] });
      this.filters.push({ col, value, op: "eq" });
      return this;
    }
    in(col: string, value: unknown[]): this {
      calls.push({ table: this.tableName, method: "in", args: [col, value] });
      this.filters.push({ col, value, op: "in" });
      return this;
    }
    is(col: string, value: unknown): this {
      calls.push({ table: this.tableName, method: "is", args: [col, value] });
      this.filters.push({ col, value, op: "is" });
      return this;
    }
    ilike(col: string, value: string): this {
      calls.push({ table: this.tableName, method: "ilike", args: [col, value] });
      this.filters.push({ col, value, op: "ilike" });
      return this;
    }
    order(col: string, opts?: { ascending?: boolean }): this {
      calls.push({ table: this.tableName, method: "order", args: [col, opts] });
      this.orders.push({ col, asc: opts?.ascending ?? true });
      return this;
    }
    range(from: number, to: number): this {
      calls.push({ table: this.tableName, method: "range", args: [from, to] });
      this.rangeArgs = [from, to];
      return this;
    }
    limit(n: number): this {
      calls.push({ table: this.tableName, method: "limit", args: [n] });
      this.limitN = n;
      return this;
    }

    private runSelect(): { data: Row[]; count: number } {
      let rows = table(this.tableName).filter((row) => matches(row, this.filters));
      for (const { col, asc } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
          return asc ? cmp : -cmp;
        });
      }
      const count = rows.length;
      if (this.rangeArgs) rows = rows.slice(this.rangeArgs[0], this.rangeArgs[1] + 1);
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      return { data: rows.map((row) => project(row, this.selectCols)), count };
    }

    private runWrite(): Row[] {
      const rows = table(this.tableName);
      if (this.op === "insert" || this.op === "upsert") {
        const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
        return inputs.map((input) => {
          const row: Row = {
            id: crypto.randomUUID(),
            created_at: NOW,
            updated_at: NOW,
            changed_at: NOW,
            ...(input as Row),
          };
          rows.push(row);
          return row;
        });
      }
      if (this.op === "update") {
        const matched = rows.filter((row) => matches(row, this.filters));
        for (const row of matched) Object.assign(row, this.payload as Row);
        return matched;
      }
      const removed = rows.filter((row) => matches(row, this.filters));
      const remaining = rows.filter((row) => !matches(row, this.filters));
      rows.splice(0, rows.length, ...remaining);
      return removed;
    }

    async maybeSingle() {
      calls.push({ table: this.tableName, method: "maybeSingle", args: [] });
      if (this.op === "select") {
        const { data } = this.runSelect();
        return { data: data[0] ?? null, error: null };
      }
      return { data: this.runWrite()[0] ?? null, error: null };
    }

    async single() {
      calls.push({ table: this.tableName, method: "single", args: [] });
      if (this.op === "select") {
        const { data } = this.runSelect();
        return { data: data[0] ?? null, error: null };
      }
      return { data: this.runWrite()[0] ?? null, error: null };
    }

    then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      let result: { data: unknown; error: unknown; count?: number };
      if (this.op === "select") {
        const { data, count } = this.runSelect();
        result = this.countFlag ? { data, error: null, count } : { data, error: null };
      } else {
        this.runWrite();
        result = { data: null, error: null };
      }
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  const client = { from: (name: string) => new Query(name) };

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

// getVisasByClientId usa service role (el portal autentica con PIN propio, no
// con Supabase Auth); canUseServiceRole() exige esta key, igual que en
// client-portal.test.ts / services.test.ts.
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

import {
  createVisa,
  getVisaById,
  getVisasByClientId,
  getVisasWithClients,
  getVisaStatusHistory,
  setVisaClients,
  transitionVisaStatus,
  updateVisa,
} from "@/lib/data/visas";

function seedVisa(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "v1",
    client_id: "c1",
    country: "France",
    visa_type: "Tourist",
    deadline: "2026-12-01",
    price: 150,
    notes: null,
    status: "pending",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
    ...overrides,
  };
  db.table("visas").push(row);
  return row;
}

function seedClient(id: string, name = "Test Client") {
  db.table("clients").push({
    id,
    name,
    slug: id,
    email: `${id}@example.com`,
    phone: "+52 55 0000 0000",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });
}

beforeEach(() => db.reset());

describe("visa data layer — createVisa (Supabase contract)", () => {
  it("rejects missing country", async () => {
    await expect(
      createVisa({ country: "", visaType: "Tourist", deadline: "2026-12-01", price: 100 })
    ).rejects.toThrow(/country/i);
  });

  it("rejects missing visaType", async () => {
    await expect(
      createVisa({ country: "France", visaType: "", deadline: "2026-12-01", price: 100 })
    ).rejects.toThrow(/visaType|visa type/i);
  });

  it("rejects missing deadline", async () => {
    await expect(
      createVisa({ country: "France", visaType: "Tourist", deadline: "", price: 100 })
    ).rejects.toThrow(/deadline/i);
  });

  it("rejects missing price", async () => {
    await expect(
      createVisa({
        country: "France",
        visaType: "Tourist",
        deadline: "2026-12-01",
        price: undefined as unknown as number,
      })
    ).rejects.toThrow(/price/i);
  });

  it("inserts the visa, its client links, and the initial history row", async () => {
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Honeymoon",
      clientIds: ["c1", "c2"],
    });

    expect(visa).toMatchObject({
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Honeymoon",
      status: "pending",
    });
    expect(visa.createdAt).toBeTruthy();
    expect(visa.updatedAt).toBe(visa.createdAt);

    const insertVisa = db.callsFor("visas", "insert").at(-1);
    expect(insertVisa?.args[0]).toEqual({
      client_id: "c1",
      country: "France",
      visa_type: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Honeymoon",
      status: "pending",
    });

    const insertClients = db.callsFor("visa_clients", "insert").at(-1);
    expect(insertClients?.args[0]).toEqual([
      { visa_id: visa.id, client_id: "c1" },
      { visa_id: visa.id, client_id: "c2" },
    ]);

    const insertHistory = db.callsFor("visa_status_history", "insert").at(-1);
    expect(insertHistory?.args[0]).toEqual({
      visa_id: visa.id,
      from_status: null,
      to_status: "pending",
    });
  });

  it("uses the first client as the compatibility mirror and trims notes", async () => {
    const visa = await createVisa({
      country: " France ",
      visaType: " Tourist ",
      deadline: "2026-12-01",
      price: 150,
      notes: "  Honeymoon  ",
      clientIds: ["c1"],
    });

    const insertVisa = db.callsFor("visas", "insert").at(-1);
    expect(insertVisa?.args[0]).toMatchObject({
      client_id: "c1",
      country: "France",
      visa_type: "Tourist",
      notes: "Honeymoon",
    });
    expect(visa.clientId).toBe("c1");
  });

  it("accepts an empty clientIds list without writing links and keeps a null mirror", async () => {
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      clientIds: [],
    });

    expect(visa.clientId).toBe("");
    expect(db.callsFor("visa_clients", "insert")).toHaveLength(0);
    expect(db.callsFor("visas", "insert").at(-1)?.args[0]).toMatchObject({ client_id: null });
  });
});

describe("visa data layer — read operations (Supabase contract)", () => {
  it("getVisaById reads '*', hydrates clients, and loads history ordered by changed_at", async () => {
    seedVisa({ id: "v1", client_id: "c1" });
    seedClient("c1", "Ana");
    db.table("visa_clients").push({
      visa_id: "v1",
      client_id: "c1",
      created_at: "2026-09-30T10:00:00Z",
    });
    db.table("visa_status_history").push({
      id: "vsh1",
      visa_id: "v1",
      from_status: null,
      to_status: "pending",
      changed_at: "2026-09-30T10:00:00Z",
    });

    const visa = await getVisaById("v1");

    expect(visa).not.toBeNull();
    expect(visa).toMatchObject({
      id: "v1",
      country: "France",
      clientId: "c1",
    });
    expect(visa!.clients.map((c) => c.id)).toEqual(["c1"]);
    expect(visa!.client.id).toBe("c1");
    expect(visa!.statusHistory.map((h) => h.toStatus)).toEqual(["pending"]);
    expect(visa!.documents).toEqual([]);

    expect(db.callsFor("visas", "select")[0].args).toEqual(["*"]);
    expect(db.callsFor("visas", "eq")).toContainEqual(
      expect.objectContaining({ args: ["id", "v1"] })
    );
    expect(db.callsFor("visa_clients", "select")[0].args).toEqual(["client_id, created_at"]);
    expect(db.callsFor("visa_status_history", "order")[0].args).toEqual([
      "changed_at",
      { ascending: true },
    ]);
  });

  it("getVisaById returns null for a non-existent id", async () => {
    await expect(getVisaById("missing-id")).resolves.toBeNull();
  });

  it("getVisasWithClients paginates with count exact and maps hydrated clients", async () => {
    seedVisa({ id: "v1", created_at: "2026-09-30T10:00:00Z" });
    seedVisa({
      id: "v2",
      country: "Japan",
      visa_type: "Business",
      created_at: "2026-09-29T10:00:00Z",
    });
    seedClient("c1", "Ana");
    seedClient("c2", "Roberto");
    db.table("visa_clients").push(
      { visa_id: "v1", client_id: "c1", created_at: "2026-09-30T10:00:00Z" },
      { visa_id: "v2", client_id: "c2", created_at: "2026-09-29T10:00:00Z" }
    );

    const page1 = await getVisasWithClients({ page: 1, pageSize: 1 });

    expect(page1.totalCount).toBe(2);
    expect(page1.items).toHaveLength(1);
    expect(page1.items[0].id).toBe("v1");
    expect(page1.items[0].clients.map((c) => c.id)).toEqual(["c1"]);

    const countSelect = db.callsFor("visas", "select")[0];
    expect(countSelect.args).toEqual(["*", { count: "exact" }]);
    expect(db.callsFor("visas", "order")[0].args).toEqual(["created_at", { ascending: false }]);
    expect(db.callsFor("visas", "range")[0].args).toEqual([0, 0]);

    const page2 = await getVisasWithClients({ page: 2, pageSize: 1 });
    expect(page2.items[0].id).toBe("v2");
    expect(page2.items[0].clients.map((c) => c.id)).toEqual(["c2"]);
  });

  it("getVisasWithClients pushes status filters to .in and pre-resolves clientIds through visa_clients", async () => {
    seedVisa({ id: "v1", status: "pending" });
    seedVisa({ id: "v2", country: "Japan", status: "in_progress" });
    seedClient("c1");
    seedClient("c2");
    db.table("visa_clients").push(
      { visa_id: "v1", client_id: "c1", created_at: "2026-09-30T10:00:00Z" },
      { visa_id: "v2", client_id: "c2", created_at: "2026-09-29T10:00:00Z" }
    );

    const byStatus = await getVisasWithClients({ filters: { status: ["pending"] } });
    expect(byStatus.items.map((v) => v.id)).toEqual(["v1"]);
    expect(db.callsFor("visas", "in")).toContainEqual(
      expect.objectContaining({ args: ["status", ["pending"]] })
    );

    const byClient = await getVisasWithClients({ filters: { clientIds: ["c2"] } });
    expect(byClient.items.map((v) => v.id)).toEqual(["v2"]);
    expect(db.callsFor("visa_clients", "in")).toContainEqual(
      expect.objectContaining({ args: ["client_id", ["c2"]] })
    );
  });

  it("getVisasByClientId resolves the link set then fetches those visas", async () => {
    seedVisa({ id: "v1", created_at: "2026-09-30T10:00:00Z" });
    seedVisa({
      id: "v2",
      country: "Japan",
      created_at: "2026-09-29T10:00:00Z",
    });
    db.table("visa_clients").push(
      { visa_id: "v1", client_id: "c1", created_at: "2026-09-30T10:00:00Z" },
      { visa_id: "v2", client_id: "c2", created_at: "2026-09-29T10:00:00Z" }
    );

    const forC1 = await getVisasByClientId("c1");
    expect(forC1.map((v) => v.id)).toEqual(["v1"]);

    expect(db.callsFor("visa_clients", "select")[0].args).toEqual(["visa_id"]);
    expect(db.callsFor("visa_clients", "eq")[0].args).toEqual(["client_id", "c1"]);
    expect(db.callsFor("visas", "in")[0].args).toEqual(["id", ["v1"]]);
    expect(db.callsFor("visas", "order")[0].args).toEqual(["created_at", { ascending: false }]);

    await expect(getVisasByClientId("unknown-client")).resolves.toEqual([]);
  });
});

describe("visa data layer — updateVisa (Supabase contract)", () => {
  it("updates only the mapped mutable fields plus updated_at", async () => {
    seedVisa({ id: "v1", notes: "Honeymoon", status: "pending" });

    const updated = await updateVisa("v1", {
      country: " Spain ",
      visaType: " Work ",
      deadline: "2027-01-15",
      price: 250,
      notes: "Updated notes",
    });

    const updateCall = db.callsFor("visas", "update").at(-1);
    expect(updateCall?.args[0]).toMatchObject({
      country: "Spain",
      visa_type: "Work",
      deadline: "2027-01-15",
      price: 250,
      notes: "Updated notes",
    });
    expect(typeof (updateCall?.args[0] as Record<string, unknown>).updated_at).toBe("string");
    expect(updateCall?.args[0]).not.toHaveProperty("status");
    expect(db.callsFor("visas", "eq")).toContainEqual(
      expect.objectContaining({ args: ["id", "v1"] })
    );
    expect(updated.country).toBe("Spain");
    expect(updated.status).toBe("pending");
  });

  it("never writes status through updateVisa (compile-time + runtime)", async () => {
    seedVisa({ id: "v1", status: "pending" });

    const updated = await updateVisa("v1", { country: "Italy" });

    const patch = db.callsFor("visas", "update").at(-1)?.args[0] as Record<string, unknown>;
    expect(patch).not.toHaveProperty("status");
    expect(updated.status).toBe("pending");
  });

  it("leaves assigned clients untouched after a field edit", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push(
      { visa_id: "v1", client_id: "c1", created_at: "2026-09-30T10:00:00Z" },
      { visa_id: "v1", client_id: "c2", created_at: "2026-09-30T10:01:00Z" }
    );

    await updateVisa("v1", { price: 999 });

    expect(db.callsFor("visa_clients", "insert")).toHaveLength(0);
    expect(db.callsFor("visa_clients", "upsert")).toHaveLength(0);
    expect(db.callsFor("visa_clients", "delete")).toHaveLength(0);
    const assigned = db
      .table("visa_clients")
      .map((vc) => vc.client_id as string)
      .sort();
    expect(assigned).toEqual(["c1", "c2"]);
  });
});

describe("visa data layer — setVisaClients (Supabase contract)", () => {
  it("diffs the assignment set: adds only new links and preserves retained rows", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push({
      visa_id: "v1",
      client_id: "c1",
      created_at: "2026-09-30T10:00:00Z",
    });

    await setVisaClients("v1", ["c1", "c2"]);

    expect(db.callsFor("visa_clients", "delete")).toHaveLength(0);
    const upsert = db.callsFor("visa_clients", "upsert").at(-1);
    expect(upsert?.args[0]).toEqual([{ visa_id: "v1", client_id: "c2" }]);
    expect(upsert?.args[1]).toEqual({
      onConflict: "visa_id,client_id",
      ignoreDuplicates: true,
    });
    expect(db.callsFor("visas", "update").at(-1)?.args[0]).toEqual({ client_id: "c1" });
  });

  it("re-assigning the same client set is idempotent (no link writes)", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push({
      visa_id: "v1",
      client_id: "c1",
      created_at: "2026-09-30T10:00:00Z",
    });

    await setVisaClients("v1", ["c1"]);
    await setVisaClients("v1", ["c1"]);

    expect(db.callsFor("visa_clients", "upsert")).toHaveLength(0);
    expect(db.callsFor("visa_clients", "delete")).toHaveLength(0);
    expect(db.table("visa_clients")).toHaveLength(1);
  });

  it("assigning multiple clients at once creates one link per client", async () => {
    seedVisa({ id: "v1" });

    await setVisaClients("v1", ["c2", "c3"]);

    expect(db.callsFor("visa_clients", "upsert").at(-1)?.args[0]).toEqual([
      { visa_id: "v1", client_id: "c2" },
      { visa_id: "v1", client_id: "c3" },
    ]);
    expect(db.callsFor("visas", "update").at(-1)?.args[0]).toEqual({ client_id: "c2" });
  });

  it("unassigning one client deletes only that client and leaves the rest", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push(
      { visa_id: "v1", client_id: "c1", created_at: "2026-09-30T10:00:00Z" },
      { visa_id: "v1", client_id: "c2", created_at: "2026-09-30T10:01:00Z" }
    );

    await setVisaClients("v1", ["c1"]);

    expect(db.callsFor("visa_clients", "delete").at(-1)?.args).toEqual([]);
    expect(db.callsFor("visa_clients", "in")).toContainEqual(
      expect.objectContaining({ args: ["client_id", ["c2"]] })
    );
    expect(db.callsFor("visa_clients", "upsert")).toHaveLength(0);
    expect(db.table("visa_clients").map((vc) => vc.client_id)).toEqual(["c1"]);
    expect(db.callsFor("visas", "update").at(-1)?.args[0]).toEqual({ client_id: "c1" });
  });

  it("unassigning a non-assigned client is a no-op", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push(
      { visa_id: "v1", client_id: "c1", created_at: "2026-09-30T10:00:00Z" },
      { visa_id: "v1", client_id: "c2", created_at: "2026-09-30T10:01:00Z" },
      { visa_id: "v1", client_id: "c3", created_at: "2026-09-30T10:02:00Z" }
    );

    await setVisaClients("v1", ["c1", "c2", "c3"]);

    expect(db.callsFor("visa_clients", "delete")).toHaveLength(0);
    expect(db.callsFor("visa_clients", "upsert")).toHaveLength(0);
  });

  it("unassigning all clients deletes every link and clears the mirror", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push({
      visa_id: "v1",
      client_id: "c1",
      created_at: "2026-09-30T10:00:00Z",
    });

    await setVisaClients("v1", []);

    expect(db.callsFor("visa_clients", "in")).toContainEqual(
      expect.objectContaining({ args: ["client_id", ["c1"]] })
    );
    expect(db.table("visa_clients")).toHaveLength(0);
    expect(db.callsFor("visas", "update").at(-1)?.args[0]).toEqual({ client_id: null });
  });
});

describe("visa data layer — transitionVisaStatus (Supabase contract)", () => {
  it("allows pending -> in_progress, updates the visa, and appends history", async () => {
    seedVisa({ id: "v1", status: "pending" });
    db.table("visa_status_history").push({
      id: "vsh-initial",
      visa_id: "v1",
      from_status: null,
      to_status: "pending",
      changed_at: "2026-09-30T10:00:00Z",
    });

    const entry = await transitionVisaStatus("v1", "in_progress");

    expect(entry).toMatchObject({
      visaId: "v1",
      fromStatus: "pending",
      toStatus: "in_progress",
    });

    const visaUpdate = db.callsFor("visas", "update").at(-1);
    expect(visaUpdate?.args[0]).toMatchObject({ status: "in_progress" });
    expect(typeof (visaUpdate?.args[0] as Record<string, unknown>).updated_at).toBe("string");

    const historyInsert = db.callsFor("visa_status_history", "insert").at(-1);
    expect(historyInsert?.args[0]).toEqual({
      visa_id: "v1",
      from_status: "pending",
      to_status: "in_progress",
    });

    const fetched = await getVisaStatusHistory("v1");
    expect(fetched.map((h) => h.toStatus)).toEqual(["pending", "in_progress"]);
  });

  it("allows in_progress -> completed and appends a history entry", async () => {
    seedVisa({ id: "v1", status: "in_progress" });
    db.table("visa_status_history").push(
      {
        id: "vsh-pending",
        visa_id: "v1",
        from_status: null,
        to_status: "pending",
        changed_at: "2026-09-30T10:00:00Z",
      },
      {
        id: "vsh-in-progress",
        visa_id: "v1",
        from_status: "pending",
        to_status: "in_progress",
        changed_at: "2026-09-30T10:01:00Z",
      }
    );

    const entry = await transitionVisaStatus("v1", "completed");

    expect(entry).toMatchObject({ fromStatus: "in_progress", toStatus: "completed" });
    expect(db.callsFor("visas", "update").at(-1)?.args[0]).toMatchObject({ status: "completed" });
  });

  it("rejects backward and skip transitions without writing", async () => {
    seedVisa({ id: "v1", status: "pending" });

    await expect(transitionVisaStatus("v1", "completed")).rejects.toThrow(/pending -> completed/);
    expect(db.callsFor("visas", "update")).toHaveLength(0);
    expect(db.callsFor("visa_status_history", "insert")).toHaveLength(0);

    seedVisa({ id: "v2", status: "in_progress" });
    await expect(transitionVisaStatus("v2", "pending")).rejects.toThrow(/in_progress -> pending/);
    expect(db.callsFor("visas", "update")).toHaveLength(0);
  });

  it("rejects any transition from completed (terminal state)", async () => {
    seedVisa({ id: "v1", status: "completed" });

    await expect(transitionVisaStatus("v1", "pending")).rejects.toThrow(/completed -> pending/);
    await expect(transitionVisaStatus("v1", "in_progress")).rejects.toThrow(
      /completed -> in_progress/
    );
    expect(db.callsFor("visas", "update")).toHaveLength(0);
    expect(db.callsFor("visa_status_history", "insert")).toHaveLength(0);
  });
});

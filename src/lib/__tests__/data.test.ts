import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Facade (barrel) contract for `src/lib/data.ts`.
 *
 * Two concerns live here:
 *  1. Surface: the barrel must re-export every domain module symbol by
 *     reference and expose nothing of its own, so `@/lib/data` can never grow
 *     logic. Behavior coverage for each domain lives in the dedicated module
 *     tests (batches 1-2) and the domain-contract suites.
 *  2. Routing: a representative read + write per major domain family is driven
 *     through the barrel against a mocked Supabase client (migration pattern
 *     "a" — see helpers/db.ts) to prove the public entry points reach the real
 *     Supabase branch of their domain module.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const NOW = "2026-11-01T12:00:00.000Z";

  const table = (name: string): Row[] => {
    let rows = tables.get(name);
    if (!rows) {
      rows = [];
      tables.set(name, rows);
    }
    return rows;
  };

  class Query {
    private filters: Filter[] = [];
    private orders: { col: string; asc: boolean }[] = [];
    private rangeArgs: [number, number] | null = null;
    private op: "select" | "insert" | "upsert" = "select";
    private payload: unknown;
    private countFlag = false;

    constructor(private tableName: string) {}

    select(cols = "*", opts?: { count?: string }): this {
      calls.push({ table: this.tableName, method: "select", args: opts === undefined ? [cols] : [cols, opts] });
      if (opts?.count) this.countFlag = true;
      return this;
    }
    insert(payload: unknown): this {
      calls.push({ table: this.tableName, method: "insert", args: [payload] });
      this.op = "insert";
      this.payload = payload;
      return this;
    }
    upsert(payload: unknown, opts?: { onConflict?: string }): this {
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
    order(col: string, opts?: { ascending?: boolean }): this {
      calls.push({ table: this.tableName, method: "order", args: opts === undefined ? [col] : [col, opts] });
      this.orders.push({ col, asc: opts?.ascending ?? true });
      return this;
    }
    range(from: number, to: number): this {
      calls.push({ table: this.tableName, method: "range", args: [from, to] });
      this.rangeArgs = [from, to];
      return this;
    }

    private matched(): Row[] {
      let rows = table(this.tableName).filter((row) =>
        this.filters.every((filter) =>
          filter.op === "eq"
            ? row[filter.col] === filter.value
            : (filter.value as unknown[]).includes(row[filter.col])
        )
      );
      for (const { col, asc } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const cmp = String(a[col] ?? "").localeCompare(String(b[col] ?? ""));
          return asc ? cmp : -cmp;
        });
      }
      if (this.rangeArgs) rows = rows.slice(this.rangeArgs[0], this.rangeArgs[1] + 1);
      return rows;
    }

    private write(): Row[] {
      const rows = table(this.tableName);
      const inputs = Array.isArray(this.payload) ? this.payload : [this.payload];
      return inputs.map((input) => {
        const data = input as Row;
        const row: Row = { id: crypto.randomUUID(), created_at: NOW, updated_at: NOW, changed_at: NOW, ...data };
        rows.push(row);
        return row;
      });
    }

    async maybeSingle() {
      calls.push({ table: this.tableName, method: "maybeSingle", args: [] });
      const rows = this.op === "select" ? this.matched() : this.write();
      return { data: rows[0] ?? null, error: null };
    }

    async single() {
      calls.push({ table: this.tableName, method: "single", args: [] });
      const rows = this.op === "select" ? this.matched() : this.write();
      return { data: rows[0] ?? null, error: null };
    }

    then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
      onfulfilled?:
        | ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): PromiseLike<TResult1 | TResult2> {
      let result: { data: unknown; error: unknown; count?: number };
      if (this.op === "select") {
        const rows = this.matched();
        result = this.countFlag ? { data: rows, error: null, count: rows.length } : { data: rows, error: null };
      } else {
        this.write();
        result = { data: null, error: null };
      }
      return Promise.resolve(result).then(onfulfilled, onrejected);
    }
  }

  return {
    calls,
    client: { from: (name: string) => new Query(name) },
    seed(tableName: string, rows: Row[]) {
      table(tableName).push(...rows);
    },
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

// Las lecturas de visas del portal usan service role; canUseServiceRole()
// exige esta key, igual que en client-portal.test.ts / services.test.ts.
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

import * as dataFacade from "@/lib/data";
import * as sharedModule from "@/lib/data/shared";
import * as clientsModule from "@/lib/data/clients";
import * as profilesModule from "@/lib/data/profiles";
import * as suppliersModule from "@/lib/data/suppliers";
import * as travelAgentsModule from "@/lib/data/travel-agents";
import * as tripsModule from "@/lib/data/trips";
import * as documentsModule from "@/lib/data/documents";
import * as servicesModule from "@/lib/data/services";
import * as dashboardModule from "@/lib/data/dashboard";
import * as settingsModule from "@/lib/data/settings";
import * as feedbackModule from "@/lib/data/feedback";
import * as visasModule from "@/lib/data/visas";
import * as visaDocumentsModule from "@/lib/data/visa-documents";

const DOMAIN_MODULES = {
  shared: sharedModule,
  clients: clientsModule,
  profiles: profilesModule,
  suppliers: suppliersModule,
  travelAgents: travelAgentsModule,
  trips: tripsModule,
  documents: documentsModule,
  services: servicesModule,
  dashboard: dashboardModule,
  settings: settingsModule,
  feedback: feedbackModule,
  visas: visasModule,
  visaDocuments: visaDocumentsModule,
} as const;

const domainSymbols = new Map<string, unknown>();
for (const module of Object.values(DOMAIN_MODULES)) {
  for (const [symbol, value] of Object.entries(module)) {
    domainSymbols.set(symbol, value);
  }
}

const facade = dataFacade as unknown as Record<string, unknown>;

beforeEach(() => db.reset());

describe("data facade surface (barrel contract)", () => {
  it("re-exports every domain module symbol by reference and adds no logic of its own", () => {
    for (const [symbol, value] of domainSymbols) {
      expect(facade[symbol], `@/lib/data should re-export ${symbol}`).toBe(value);
    }
  });

  it("exposes exactly the union of its domain module exports", () => {
    expect(Object.keys(dataFacade).sort()).toEqual([...domainSymbols.keys()].sort());
  });
});

describe("data facade routing (mocked Supabase client)", () => {
  it("clients read: resolves getClients through the clients domain, newest first", async () => {
    db.seed("clients", [
      { id: "client-1", name: "Ana Pérez", email: "ana@example.com", created_at: "2026-11-02T00:00:00.000Z" },
      { id: "client-2", name: "Bruno Díaz", email: "bruno@example.com", created_at: "2026-11-01T00:00:00.000Z" },
    ]);

    const result = await dataFacade.getClients({ page: 1, pageSize: 2 });

    expect(result.totalCount).toBe(2);
    expect(result.items.map((client) => client.id)).toEqual(["client-1", "client-2"]);
    expect(db.callsFor("clients", "select")[0].args).toEqual(["*", { count: "exact" }]);
  });

  it("clients write: createClient inserts the mapped row and returns the persisted client", async () => {
    const created = await dataFacade.createClient({
      name: "Facade Client",
      email: "facade@example.com",
      phone: "+52 55 0000 1111",
      whatsapp: "+52 55 0000 2222",
    });

    expect(created.id).toBeTruthy();
    expect(created.name).toBe("Facade Client");
    expect(created.phone).toBe("+52 55 0000 1111");
    expect(created.whatsapp).toBe("+52 55 0000 2222");
    expect(db.callsFor("clients", "insert")[0].args[0]).toMatchObject({
      name: "Facade Client",
      email: "facade@example.com",
    });
  });

  it("trips read: resolves getTrips through the trips domain and hides templates", async () => {
    db.seed("trips", [
      { id: "trip-1", title: "Viaje A", slug: "viaje-a", is_template: false, status: "draft", currency: "MXN", created_at: "2026-11-02T00:00:00.000Z" },
      { id: "trip-2", title: "Viaje B", slug: "viaje-b", is_template: false, status: "published", currency: "EUR", created_at: "2026-11-01T00:00:00.000Z" },
      { id: "trip-tpl", title: "Plantilla", slug: "plantilla", is_template: true, status: "draft", currency: "MXN", created_at: "2026-11-03T00:00:00.000Z" },
    ]);

    const result = await dataFacade.getTrips({ page: 1, pageSize: 10 });

    expect(result.items.map((trip) => trip.id)).toEqual(["trip-1", "trip-2"]);
    expect(result.items.every((trip) => trip.isTemplate === false)).toBe(true);
    expect(db.callsFor("trips", "eq")[0].args).toEqual(["is_template", false]);
  });

  it("trips write: createTrip inserts the trip, links clients and provisions their service", async () => {
    const trip = await dataFacade.createTrip({
      clientIds: ["client-x"],
      title: "Facade Trip",
      slug: "facade-trip",
      startDate: "2026-11-01",
      endDate: "2026-11-02",
    });

    expect(trip.id).toBeTruthy();
    expect(trip.title).toBe("Facade Trip");
    expect(db.callsFor("trips", "insert")[0].args[0]).toMatchObject({ slug: "facade-trip", title: "Facade Trip" });
    expect(db.callsFor("trip_clients", "insert")[0].args[0]).toEqual([{ trip_id: trip.id, client_id: "client-x" }]);
    expect(db.callsFor("services", "upsert")[0].args[1]).toEqual({ onConflict: "trip_id,client_id,service_type" });
  });

  it("services read: resolves getServicesForTrip through the services domain", async () => {
    db.seed("services", [
      { id: "service-1", trip_id: "trip-1", client_id: "client-1", service_type: "trip_documents", status: "active", created_at: "2026-11-01T00:00:00.000Z" },
      { id: "service-2", trip_id: "trip-1", client_id: "client-2", service_type: "trip_documents", status: "active", created_at: "2026-11-02T00:00:00.000Z" },
      { id: "service-other", trip_id: "trip-9", client_id: "client-1", service_type: "trip_documents", status: "active", created_at: "2026-11-03T00:00:00.000Z" },
    ]);

    const services = await dataFacade.getServicesForTrip("trip-1");

    expect(services.map((service) => service.id)).toEqual(["service-1", "service-2"]);
    expect(db.callsFor("services", "eq")[0].args).toEqual(["trip_id", "trip-1"]);
  });

  it("services write: ensureServiceForAssignment upserts the default trip_documents service", async () => {
    const service = await dataFacade.ensureServiceForAssignment("trip-1", "client-1");

    expect(service.tripId).toBe("trip-1");
    expect(service.clientId).toBe("client-1");
    expect(service.serviceType).toBe("trip_documents");
    expect(db.callsFor("services", "upsert")[0].args).toEqual([
      { trip_id: "trip-1", client_id: "client-1", service_type: "trip_documents", status: "active" },
      { onConflict: "trip_id,client_id,service_type" },
    ]);
  });

  it("visas read: resolves getVisasByClientId through the visa client links", async () => {
    db.seed("visa_clients", [{ visa_id: "visa-1", client_id: "client-1" }]);
    db.seed("visas", [
      { id: "visa-1", client_id: "client-1", country: "Japón", visa_type: "turismo", deadline: "2026-12-01", price: 1200, status: "pending", created_at: "2026-11-01T00:00:00.000Z" },
    ]);

    const visas = await dataFacade.getVisasByClientId("client-1");

    expect(visas).toHaveLength(1);
    expect(visas[0]).toMatchObject({ id: "visa-1", country: "Japón", status: "pending" });
    expect(db.callsFor("visa_clients", "eq")[0].args).toEqual(["client_id", "client-1"]);
  });

  it("visas write: createVisa inserts the visa, client links and opening history entry", async () => {
    const visa = await dataFacade.createVisa({
      clientIds: ["client-1"],
      country: "Japón",
      visaType: "turismo",
      deadline: "2026-12-01",
      price: 1200,
    });

    expect(visa.id).toBeTruthy();
    expect(visa.status).toBe("pending");
    expect(db.callsFor("visas", "insert")[0].args[0]).toMatchObject({ country: "Japón", visa_type: "turismo", status: "pending" });
    expect(db.callsFor("visa_clients", "insert")[0].args[0]).toEqual([{ visa_id: visa.id, client_id: "client-1" }]);
    expect(db.callsFor("visa_status_history", "insert")[0].args[0]).toEqual({
      visa_id: visa.id,
      from_status: null,
      to_status: "pending",
    });
  });
});

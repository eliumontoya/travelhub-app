import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Domain-boundary contracts for the data facade. The runtime halves run through
 * the mocked-client contract pattern (migration pattern "a" — see
 * helpers/db.ts): `isSupabaseConfigured()` is true and the real Supabase branch
 * of the client/trip/document domain modules runs against an in-memory fake, so
 * the facade boundary and the real query shapes are asserted together.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" | "ilike" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const NOW = "2026-11-01T12:00:00.000Z";

  const storage = {
    uploads: [] as { bucket: string; path: string }[],
    signed: [] as { bucket: string; path: string; expiresIn: number }[],
  };

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
    private conflictKeys: string[] | null = null;

    constructor(private tableName: string) {}

    select(cols = "*", opts?: { count?: string }): this {
      calls.push({
        table: this.tableName,
        method: "select",
        args: opts === undefined ? [cols] : [cols, opts],
      });
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
    upsert(payload: unknown, opts?: { onConflict?: string }): this {
      calls.push({ table: this.tableName, method: "upsert", args: [payload, opts] });
      this.op = "upsert";
      this.payload = payload;
      this.conflictKeys = opts?.onConflict?.split(",") ?? null;
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
      calls.push({
        table: this.tableName,
        method: "order",
        args: opts === undefined ? [col] : [col, opts],
      });
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
          const data = input as Row;
          if (this.op === "upsert" && this.conflictKeys) {
            const existing = rows.find((row) =>
              this.conflictKeys!.every((key) => row[key] === data[key])
            );
            if (existing) {
              Object.assign(existing, data);
              return existing;
            }
          }
          const row: Row = {
            id: crypto.randomUUID(),
            created_at: NOW,
            updated_at: NOW,
            changed_at: NOW,
            uploaded_at: NOW,
            ...data,
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
      if (this.op === "select") return { data: this.runSelect().data[0] ?? null, error: null };
      return { data: this.runWrite()[0] ?? null, error: null };
    }

    async single() {
      calls.push({ table: this.tableName, method: "single", args: [] });
      if (this.op === "select") return { data: this.runSelect().data[0] ?? null, error: null };
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

  const client = {
    from: (name: string) => new Query(name),
    storage: {
      from: (bucket: string) => ({
        async upload(path: string) {
          storage.uploads.push({ bucket, path });
          return { data: { path }, error: null };
        },
        async createSignedUrl(path: string, expiresIn: number) {
          storage.signed.push({ bucket, path, expiresIn });
          return { data: { signedUrl: `https://signed.example/${bucket}/${path}` }, error: null };
        },
        getPublicUrl(path: string) {
          return { data: { publicUrl: `https://public.example/${bucket}/${path}` } };
        },
      }),
    },
  };

  return {
    calls,
    client,
    table,
    storage,
    reset() {
      tables.clear();
      calls.length = 0;
      storage.uploads.length = 0;
      storage.signed.length = 0;
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

import * as dataFacade from "@/lib/data";
import {
  createClient,
  getClientById,
  getClientsWithTags,
  getOrCreateTag,
  setClientTags,
} from "@/lib/data/clients";
import { createDocument, getSignedDocumentUrl, uploadItemDocument } from "@/lib/data/documents";
import { createItem, createTrip, createTripDay, getTripById, getTripWithDetails } from "@/lib/data/trips";

beforeEach(() => db.reset());

describe("data-layer domain boundary contracts", () => {
  it("keeps the data facade as the stable named export surface", () => {
    expect(dataFacade.createClient).toBe(createClient);
    expect(dataFacade.getTripWithDetails).toBe(getTripWithDetails);
    expect(dataFacade.createDocument).toBe(createDocument);
    expect(dataFacade.DEFAULT_PAGE_SIZE).toBe(20);
  });

  it("preserves client and tag association behavior through the client domain", async () => {
    const unique = `Domain Client ${Date.now()}`;
    const client = await createClient({
      name: unique,
      email: `${unique.toLowerCase().replaceAll(" ", ".")}@example.com`,
      phone: "+52 55 1000 2000",
      whatsapp: "+52 55 1000 2000",
      notes: "<script>alert(1)</script><strong>VIP</strong>",
    });
    const tag = await getOrCreateTag(`Domain Tag ${Date.now()}`);

    await setClientTags(client.id, [tag.id]);

    const found = await getClientById(client.id);
    const tagged = await getClientsWithTags({ page: 1, pageSize: 5 });
    const taggedClient = tagged.items.find((item) => item.id === client.id);

    expect(found).toMatchObject({
      id: client.id,
      name: unique,
      whatsapp: "+52 55 1000 2000",
    });
    expect(found?.notes).toBe("<strong>VIP</strong>");
    expect(taggedClient?.tags.map((item) => item.name)).toEqual([tag.name]);

    expect(db.callsFor("clients", "insert")[0].args[0]).toMatchObject({
      name: unique,
      notes: "<strong>VIP</strong>",
      whatsapp: "+52 55 1000 2000",
    });
    expect(db.callsFor("clients", "maybeSingle")[0].args).toEqual([]);
    expect(db.callsFor("client_tags", "upsert")[0].args[0]).toEqual([
      { client_id: client.id, tag_id: tag.id },
    ]);
    expect(db.callsFor("clients", "select").some((call) => call.args[0] === "*")).toBe(true);
  });

  it("preserves trip detail assembly through the trips domain", async () => {
    const client = await createClient({ name: `Domain Traveler ${Date.now()}` });
    const slug = `domain-trip-${Date.now()}`;
    const trip = await createTrip({
      clientIds: [client.id],
      title: "Domain Contract Trip",
      slug,
      startDate: "2026-11-01",
      endDate: "2026-11-02",
    });
    const day = await createTripDay({ tripId: trip.id, date: "2026-11-01", sortOrder: 3 });
    const item = await createItem({
      tripDayId: day.id,
      type: "activity",
      title: "Museum visit",
      startTime: "10:00",
      sortOrder: 4,
      notes: "Bring voucher",
    });

    expect(db.callsFor("trips", "insert")[0].args[0]).toMatchObject({
      client_id: client.id,
      title: "Domain Contract Trip",
      slug,
    });
    expect(db.callsFor("trip_clients", "insert")[0].args[0]).toEqual([
      { trip_id: trip.id, client_id: client.id },
    ]);
    // createTrip provisions the default trip_documents service for each client.
    expect(db.callsFor("services", "upsert")[0].args[1]).toEqual({
      onConflict: "trip_id,client_id,service_type",
    });

    const details = await getTripById(trip.id);

    expect(details?.id).toBe(trip.id);
    expect(details?.clients.map((assigned) => assigned.id)).toEqual([client.id]);
    expect(details?.days).toHaveLength(1);
    expect(details?.days[0]).toMatchObject({ id: day.id, sortOrder: 3 });
    expect(details?.days[0].items).toEqual([
      expect.objectContaining({ id: item.id, title: "Museum visit" }),
    ]);

    // The public /t/[slug] assembly never hydrates clients.
    const publicDetails = await getTripWithDetails(slug);
    expect(publicDetails?.clients).toEqual([]);
    expect(publicDetails?.days[0].items.map((entry) => entry.title)).toEqual(["Museum visit"]);
  });

  it("preserves document and storage contracts through the documents domain", async () => {
    const document = await createDocument({
      itemId: "domain-item-1",
      fileUrl: "domain-item-1/voucher.pdf",
      fileName: "voucher.pdf",
      mimeType: "application/pdf",
    });

    expect(document).toMatchObject({
      itemId: "domain-item-1",
      fileUrl: "domain-item-1/voucher.pdf",
      fileName: "voucher.pdf",
      mimeType: "application/pdf",
    });
    expect(document.uploadedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    await expect(getSignedDocumentUrl(document.fileUrl)).resolves.toMatch(/^https:\/\/signed\.example\//);
    expect(db.storage.signed[0]).toEqual({
      bucket: "trip-documents",
      path: "domain-item-1/voucher.pdf",
      expiresIn: 3600,
    });

    const uploaded = await uploadItemDocument("domain-item-1", new File(["pdf"], "voucher.pdf"));
    expect(uploaded).toMatchObject({ itemId: "domain-item-1", fileName: "voucher.pdf" });
    expect(db.storage.uploads).toEqual([
      { bucket: "trip-documents", path: uploaded.fileUrl },
    ]);
    expect(db.callsFor("documents", "insert").at(-1)?.args[0]).toMatchObject({
      item_id: "domain-item-1",
      file_url: uploaded.fileUrl,
      file_name: "voucher.pdf",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Domain contracts for the visa + visa-document modules. The runtime halves run
 * against the mocked-client contract pattern (migration pattern "a" — see
 * helpers/db.ts): `isSupabaseConfigured()` is true and the real Supabase branch
 * runs against an in-memory fake, so the cross-domain isolation and lifecycle
 * contracts are proven through the actual `.from()` call sites.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" | "ilike" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const NOW = "2026-09-30T11:00:00.000Z";

  const storage = {
    uploads: [] as { bucket: string; path: string }[],
    removed: [] as { bucket: string; paths: string[] }[],
    signed: [] as { bucket: string; path: string }[],
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

  const client = {
    from: (name: string) => new Query(name),
    storage: {
      from: (bucket: string) => ({
        async upload(path: string) {
          storage.uploads.push({ bucket, path });
          return { data: { path }, error: null };
        },
        async remove(paths: string[]) {
          storage.removed.push({ bucket, paths });
          return { data: null, error: null };
        },
        async createSignedUrl(path: string) {
          storage.signed.push({ bucket, path });
          return { data: { signedUrl: `https://signed.example/${bucket}/${path}` }, error: null };
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
      storage.removed.length = 0;
      storage.signed.length = 0;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => db.client,
  getSupabaseAdmin: () => db.client,
}));

const FORBIDDEN_TABLES = [
  "trips",
  "trip_clients",
  "trip_status_history",
  "trip_documents",
  "services",
  "service_checklist_items",
  "service_uploads",
];
const FORBIDDEN_BUCKETS = ["trip-documents"];
const VISA_TABLES = ["visas", "visa_clients", "visa_status_history", "visa_documents"];
const VISA_BUCKETS = ["visa-documents"];

import {
  assertVisaDocumentMutable,
  createVisa,
  getVisaById,
  getVisaDocuments,
  getVisasWithClients,
  markVisaDocumentProcessed,
  markVisaDocumentReviewed,
  requestVisaDocument,
  requestVisaDocumentReUpload,
  setVisaClients,
  transitionVisaStatus,
  updateVisa,
  uploadVisaDocument,
  uploadVisaDocumentForRequest,
  VISA_DOCUMENTS_BUCKET,
} from "@/lib/data";
import * as dataFacade from "@/lib/data";

function seedClient(id: string, name = "Domain Test Client") {
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

// ============================================================
// 4.1 — Facade export surface for visa + visa-document modules
// ============================================================

describe("visa-domain contracts — facade export surface", () => {
  it("re-exports every visa management function from the @/lib/data facade", () => {
    expect(typeof dataFacade.createVisa).toBe("function");
    expect(typeof dataFacade.getVisaById).toBe("function");
    expect(typeof dataFacade.getVisasWithClients).toBe("function");
    expect(typeof dataFacade.getVisasByClientId).toBe("function");
    expect(typeof dataFacade.updateVisa).toBe("function");
    expect(typeof dataFacade.setVisaClients).toBe("function");
    expect(typeof dataFacade.transitionVisaStatus).toBe("function");
    expect(typeof dataFacade.getVisaStatusHistory).toBe("function");
  });

  it("re-exports every visa document function from the @/lib/data facade", () => {
    expect(typeof dataFacade.uploadVisaDocument).toBe("function");
    expect(typeof dataFacade.requestVisaDocument).toBe("function");
    expect(typeof dataFacade.uploadVisaDocumentForRequest).toBe("function");
    expect(typeof dataFacade.markVisaDocumentReviewed).toBe("function");
    expect(typeof dataFacade.markVisaDocumentProcessed).toBe("function");
    expect(typeof dataFacade.requestVisaDocumentReUpload).toBe("function");
    expect(typeof dataFacade.getVisaDocuments).toBe("function");
    expect(typeof dataFacade.getSignedVisaDocumentUrl).toBe("function");
    expect(typeof dataFacade.assertVisaDocumentMutable).toBe("function");
  });

  it("exposes the visa-documents bucket constant through the facade", () => {
    expect(dataFacade.VISA_DOCUMENTS_BUCKET).toBe("visa-documents");
  });

  it("exposes the visa transitions map through the facade", () => {
    expect(dataFacade.VISA_TRANSITIONS).toEqual({
      pending: ["in_progress"],
      in_progress: ["completed"],
      completed: [],
    });
  });
});

// ============================================================
// 4.2 — Cross-domain isolation (Supabase contract)
// ============================================================

describe("visa-domain contracts — cross-domain isolation (Supabase contract)", () => {
  it("runs every visa + visa-document operation without touching trip/service tables", async () => {
    seedClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      clientIds: ["c1"],
    });
    expect(visa.status).toBe("pending");
    await setVisaClients(visa.id, ["c1"]);
    await updateVisa(visa.id, { notes: "Updated" });
    await transitionVisaStatus(visa.id, "in_progress");
    const file = new File(["x"], "form.pdf", { type: "application/pdf" });
    const uploaded = await uploadVisaDocument(visa.id, file);
    await requestVisaDocument(visa.id, "c1", "Passport scan");
    await markVisaDocumentReviewed(uploaded.id);
    const documents = await getVisaDocuments(visa.id);
    expect(documents.some((d) => d.id === uploaded.id)).toBe(true);

    // Every table touched by the visa modules belongs to the visa domain (plus
    // `clients`, which is read-only hydration).
    const touched = new Set(db.calls.map((call) => call.table));
    FORBIDDEN_TABLES.forEach((table) =>
      expect(touched.has(table), `touched forbidden table ${table}`).toBe(false)
    );
    // Storage isolation: only the visa-documents bucket is used.
    const buckets = new Set([
      ...db.storage.uploads.map((u) => u.bucket),
      ...db.storage.removed.map((r) => r.bucket),
      ...db.storage.signed.map((s) => s.bucket),
    ]);
    buckets.forEach((bucket) => expect(bucket).toBe(VISA_DOCUMENTS_BUCKET));

    expect(db.table("visas")).toHaveLength(1);
    expect(db.table("visa_status_history").length).toBeGreaterThanOrEqual(2);
    expect(db.table("visa_documents")).toHaveLength(2);
  });

  it("uses the visa-documents bucket constant for storage isolation", () => {
    expect(VISA_DOCUMENTS_BUCKET).toBe("visa-documents");
    expect(VISA_BUCKETS).toContain(VISA_DOCUMENTS_BUCKET);
    expect(FORBIDDEN_BUCKETS).not.toContain(VISA_DOCUMENTS_BUCKET);
  });

  it("forbidden tables list covers every trip + service table", () => {
    FORBIDDEN_TABLES.forEach((t) => expect(VISA_TABLES.includes(t)).toBe(false));
  });
});

// ============================================================
// 4.2 (source-level) — AST-style file inspection to verify the visa modules do
// not contain calls to forbidden tables or forbidden storage buckets. This is
// a structural test that catches leaks at the source level and complements the
// runtime call-log assertion above.
// ============================================================

describe("visa-domain contracts — cross-domain isolation (source-level)", () => {
  it("visa + visa-documents modules do not reference forbidden tables in source", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const modulesDir = path.resolve(process.cwd(), "src/lib/data");
    const sources = [
      path.join(modulesDir, "visas.ts"),
      path.join(modulesDir, "visa-documents.ts"),
    ];
    const combined: string[] = [];
    for (const file of sources) {
      const text = await fs.readFile(file, "utf8");
      combined.push(text);
    }
    const joined = combined.join("\n");
    FORBIDDEN_TABLES.forEach((t) => {
      const fromCallPattern = new RegExp(`\\bfrom\\(["'\`]${t}["'\`]\\)`);
      expect(fromCallPattern.test(joined), `forbidden table reference: ${t}`).toBe(false);
    });
    FORBIDDEN_BUCKETS.forEach((b) => {
      const fromCallPattern = new RegExp(`\\.from\\(["'\`]${b}["'\`]\\)`);
      expect(fromCallPattern.test(joined), `forbidden bucket reference: ${b}`).toBe(false);
    });
  });

  it("visa + visa-documents modules only reference visa-domain storage bucket", async () => {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const visaDocsPath = path.resolve(process.cwd(), "src/lib/data/visa-documents.ts");
    const text = await fs.readFile(visaDocsPath, "utf8");
    const callSites = [...text.matchAll(/storage\.from\(([^)]+)\)/g)].map((m) => m[1].trim());
    expect(callSites.length).toBeGreaterThan(0);
    callSites.forEach((bucket) => {
      expect(bucket).toBe("VISA_DOCUMENTS_BUCKET");
    });
  });
});

// ============================================================
// 4.3 — Lifecycle parity through the mocked-client contract
// ============================================================

describe("visa-domain contracts — lifecycle parity (Supabase contract)", () => {
  it("create → read → transition → read sequence is consistent", async () => {
    seedClient("c1", "Ana");
    const visa = await createVisa({
      country: "Italy",
      visaType: "Schengen",
      deadline: "2027-01-15",
      price: 220,
      clientIds: ["c1"],
    });

    const read1 = await getVisaById(visa.id);
    expect(read1?.status).toBe("pending");
    expect(read1?.clients.map((c) => c.id)).toEqual(["c1"]);
    expect(read1?.statusHistory.length).toBe(1);
    expect(read1?.statusHistory[0].toStatus).toBe("pending");

    await transitionVisaStatus(visa.id, "in_progress");
    await transitionVisaStatus(visa.id, "completed");

    const read2 = await getVisaById(visa.id);
    expect(read2?.status).toBe("completed");
    expect(read2?.statusHistory.length).toBe(3);
    expect(read2?.statusHistory.map((h) => h.toStatus)).toEqual([
      "pending",
      "in_progress",
      "completed",
    ]);

    await expect(transitionVisaStatus(visa.id, "pending")).rejects.toThrow(
      /Illegal visa status transition/
    );
    const read3 = await getVisaById(visa.id);
    expect(read3?.status).toBe("completed");
    expect(read3?.statusHistory.length).toBe(3);
  });

  it("create + list returns the new visa in the paginated result", async () => {
    const unique = `ParityVisa-${Date.now()}`;
    const visa = await createVisa({
      country: unique,
      visaType: "Tourist",
      deadline: "2027-02-01",
      price: 100,
      clientIds: [],
    });

    const list = await getVisasWithClients({
      filters: { query: unique },
      page: 1,
      pageSize: 5,
    });
    expect(list.items.some((v) => v.id === visa.id)).toBe(true);
    expect(list.totalCount).toBeGreaterThan(0);
  });

  it("request → re-upload lifecycle round-trips through getVisaDocuments", async () => {
    seedClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const requested = await requestVisaDocument(visa.id, "c1", "Passport scan");
    expect(requested.status).toBe("requested");

    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const uploaded = await uploadVisaDocumentForRequest(requested.id, "c1", file);
    expect(uploaded.status).toBe("uploaded");
    expect(uploaded.filePath).toMatch(/^visas\//);

    await requestVisaDocumentReUpload(uploaded.id, "Re-upload please");
    const docs = await getVisaDocuments(visa.id);
    const updated = docs.find((d) => d.id === uploaded.id);
    expect(updated?.status).toBe("re_upload_requested");
    expect(updated?.agentComment).toBe("Re-upload please");
  });

  it("completed visas do not transition and backward transitions are rejected", async () => {
    seedClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    await transitionVisaStatus(visa.id, "in_progress");
    await transitionVisaStatus(visa.id, "completed");

    await expect(transitionVisaStatus(visa.id, "pending")).rejects.toThrow(
      /Illegal visa status transition/
    );
    await expect(transitionVisaStatus(visa.id, "in_progress")).rejects.toThrow(
      /Illegal visa status transition/
    );
    await expect(transitionVisaStatus(visa.id, "completed")).rejects.toThrow(
      /Illegal visa status transition/
    );

    const final = await getVisaById(visa.id);
    expect(final?.status).toBe("completed");
    expect(final?.statusHistory.length).toBe(3);
  });

  it("exhaustive status lifecycle: markVisaDocumentReviewed + Processed round-trip", async () => {
    seedClient("c1", "Ana");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const doc = await uploadVisaDocument(visa.id, file);
    expect(doc.status).toBe("uploaded");
    await markVisaDocumentReviewed(doc.id);
    const afterReview = (await getVisaDocuments(visa.id)).find((d) => d.id === doc.id);
    expect(afterReview?.status).toBe("reviewed");
    await markVisaDocumentProcessed(doc.id);
    const afterProcessed = (await getVisaDocuments(visa.id)).find((d) => d.id === doc.id);
    expect(afterProcessed?.status).toBe("processed");
  });

  it("ownership guard rejects cross-visa document access", async () => {
    seedClient("c1", "Ana");
    const visaA = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const visaB = await createVisa({
      country: "Japan",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const doc = await uploadVisaDocument(visaA.id, file);
    await expect(assertVisaDocumentMutable(doc.id, visaB.id)).rejects.toThrow(/not found/i);
    await expect(assertVisaDocumentMutable(doc.id, visaA.id)).resolves.toBeUndefined();
  });

  it("non-assigned client cannot upload to a visa document request", async () => {
    seedClient("c1", "Ana");
    seedClient("c2", "Bea");
    const visa = await createVisa({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 100,
      clientIds: ["c1"],
    });
    const requested = await requestVisaDocument(visa.id, "c1", "Passport scan");
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    await expect(uploadVisaDocumentForRequest(requested.id, "c2", file)).rejects.toThrow(
      /not the assigned traveler/i
    );
    await expect(uploadVisaDocumentForRequest(requested.id, "c1", file)).resolves.toMatchObject({
      status: "uploaded",
      visaId: visa.id,
    });
  });
});

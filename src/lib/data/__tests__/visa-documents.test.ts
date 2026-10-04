import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/visa-documents.ts` runs. We assert the exact
 * table/storage call shapes and the row mapping of the real queries.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" | "ilike" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const NOW = "2026-09-30T11:00:00.000Z";
  let writeError: Error | null = null;

  const storage = {
    uploads: [] as { bucket: string; path: string; contentType?: string }[],
    removed: [] as { bucket: string; paths: string[] }[],
    signed: [] as { bucket: string; path: string; expiresIn: number }[],
    uploadError: null as Error | null,
    removeError: null as Error | null,
    removeThrows: false,
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
      if (writeError) return { data: null, error: writeError };
      return { data: this.runWrite()[0] ?? null, error: null };
    }

    async single() {
      calls.push({ table: this.tableName, method: "single", args: [] });
      if (this.op === "select") {
        const { data } = this.runSelect();
        return { data: data[0] ?? null, error: null };
      }
      if (writeError) return { data: null, error: writeError };
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
      } else if (writeError) {
        result = { data: null, error: writeError };
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
        async upload(path: string, _file: unknown, opts?: { contentType?: string }) {
          storage.uploads.push({ bucket, path, contentType: opts?.contentType });
          return { data: { path }, error: storage.uploadError };
        },
        async remove(paths: string[]) {
          storage.removed.push({ bucket, paths });
          if (storage.removeThrows && storage.removeError) throw storage.removeError;
          return { data: null, error: storage.removeError };
        },
        async createSignedUrl(path: string, expiresIn: number) {
          storage.signed.push({ bucket, path, expiresIn });
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
      writeError = null;
      storage.uploads.length = 0;
      storage.removed.length = 0;
      storage.signed.length = 0;
      storage.uploadError = null;
      storage.removeError = null;
      storage.removeThrows = false;
    },
    setWriteError(error: Error | null) {
      writeError = error;
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

import {
  assertVisaDocumentMutable,
  getVisaDocuments,
  markVisaDocumentProcessed,
  markVisaDocumentReviewed,
  requestVisaDocument,
  requestVisaDocumentReUpload,
  uploadVisaDocument,
  uploadVisaDocumentForRequest,
  VISA_DOCUMENTS_BUCKET,
} from "@/lib/data/visa-documents";

const VISA_ROW = {
  id: "v1",
  client_id: "c1",
  country: "France",
  visa_type: "Tourist",
  deadline: "2026-12-01",
  price: 150,
  status: "pending",
  created_at: "2026-09-30T10:00:00Z",
  updated_at: "2026-09-30T10:00:00Z",
};

function seedVisa(overrides: Record<string, unknown> = {}) {
  db.table("visas").push({ ...VISA_ROW, ...overrides });
}

function seedDocument(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "vd1",
    visa_id: "v1",
    target_client_id: null,
    description: "Application form",
    file_path: "visas/v1/vd1-form.pdf",
    filename: "form.pdf",
    mime_type: "application/pdf",
    status: "uploaded",
    uploaded_at: "2026-09-30T10:00:00Z",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
    ...overrides,
  };
  db.table("visa_documents").push(row);
  return row;
}

beforeEach(() => db.reset());

describe("visa-documents data layer — uploadVisaDocument (Supabase contract)", () => {
  it("uploads to the visa-documents bucket then inserts the uploaded row", async () => {
    seedVisa({ id: "v1" });

    const file = new File(["binary"], "application-form.pdf", { type: "application/pdf" });
    const doc = await uploadVisaDocument("v1", file);

    expect(doc).toMatchObject({
      visaId: "v1",
      targetClientId: null,
      filename: "application-form.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
    });
    expect(doc.filePath).toMatch(/^visas\/v1\//);
    expect(doc.uploadedAt).toBeTruthy();

    expect(db.callsFor("visas", "select")[0].args).toEqual(["id"]);
    expect(db.storage.uploads).toEqual([
      { bucket: VISA_DOCUMENTS_BUCKET, path: doc.filePath, contentType: "application/pdf" },
    ]);
    const insert = db.callsFor("visa_documents", "insert").at(-1);
    expect(insert?.args[0]).toMatchObject({
      visa_id: "v1",
      target_client_id: null,
      file_path: doc.filePath,
      filename: "application-form.pdf",
      mime_type: "application/pdf",
      status: "uploaded",
    });
  });

  it("rejects upload to a non-existent visa without touching storage or tables", async () => {
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadVisaDocument("missing-visa", file)).rejects.toThrow(/visa/i);
    expect(db.storage.uploads).toHaveLength(0);
    expect(db.callsFor("visa_documents", "insert")).toHaveLength(0);
  });
});

describe("visa-documents data layer — requestVisaDocument (Supabase contract)", () => {
  it("verifies the client link then inserts a requested row with a null file_path", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push({
      visa_id: "v1",
      client_id: "c1",
      created_at: "2026-09-30T10:00:00Z",
    });

    const doc = await requestVisaDocument("v1", "c1", "  Passport scan  ");

    expect(doc).toMatchObject({
      visaId: "v1",
      targetClientId: "c1",
      description: "Passport scan",
      filePath: null,
      status: "requested",
    });
    expect(doc.uploadedAt).toBeUndefined();

    const linkSelect = db.callsFor("visa_clients", "select").at(-1);
    expect(linkSelect?.args).toEqual(["client_id"]);
    expect(db.callsFor("visa_clients", "eq").slice(-2)).toEqual([
      { table: "visa_clients", method: "eq", args: ["visa_id", "v1"] },
      { table: "visa_clients", method: "eq", args: ["client_id", "c1"] },
    ]);
    expect(db.callsFor("visa_documents", "insert").at(-1)?.args[0]).toMatchObject({
      visa_id: "v1",
      target_client_id: "c1",
      description: "Passport scan",
      file_path: null,
      status: "requested",
    });
  });

  it("rejects a request for a non-assigned client without inserting", async () => {
    seedVisa({ id: "v1" });
    db.table("visa_clients").push({
      visa_id: "v1",
      client_id: "c1",
      created_at: "2026-09-30T10:00:00Z",
    });

    await expect(requestVisaDocument("v1", "c-other", "Bank statement")).rejects.toThrow(
      /not assigned/i
    );
    expect(db.callsFor("visa_documents", "insert")).toHaveLength(0);
  });
});

describe("visa-documents data layer — getVisaDocuments (Supabase contract)", () => {
  it("returns an empty list when a visa has no documents", async () => {
    await expect(getVisaDocuments("v1")).resolves.toEqual([]);
  });

  it("selects the visa documents, orders by created_at, and signs stored files", async () => {
    seedDocument({
      id: "vd1",
      file_path: "visas/v1/vd1-form.pdf",
      created_at: "2026-09-30T10:00:00Z",
    });
    seedDocument({
      id: "vd2",
      target_client_id: "c1",
      description: "Passport scan",
      file_path: null,
      status: "requested",
      created_at: "2026-09-29T10:00:00Z",
    });

    const docs = await getVisaDocuments("v1");

    expect(docs.map((d) => d.id)).toEqual(["vd2", "vd1"]);
    expect(docs.find((d) => d.id === "vd1")?.url).toMatch(/^https:\/\/signed\.example\//);
    expect(docs.find((d) => d.id === "vd2")?.url).toBeNull();

    expect(db.callsFor("visa_documents", "select")[0].args).toEqual(["*"]);
    expect(db.callsFor("visa_documents", "eq")[0].args).toEqual(["visa_id", "v1"]);
    expect(db.callsFor("visa_documents", "order")[0].args).toEqual([
      "created_at",
      { ascending: true },
    ]);
    expect(db.storage.signed).toEqual([
      { bucket: VISA_DOCUMENTS_BUCKET, path: "visas/v1/vd1-form.pdf", expiresIn: 3600 },
    ]);
  });
});

describe("visa-documents data layer — uploadVisaDocumentForRequest (Supabase contract)", () => {
  it("uploads, patches to uploaded, and removes the previous file for a re-upload", async () => {
    seedVisa({ id: "v1" });
    seedDocument({
      id: "vd3",
      target_client_id: "c1",
      file_path: "visas/v1/old-passport.pdf",
      filename: "old-passport.pdf",
      status: "re_upload_requested",
      agent_comment: "Blurry",
    });

    const file = new File(["binary"], "passport-v2.pdf", { type: "application/pdf" });
    const doc = await uploadVisaDocumentForRequest("vd3", "c1", file);

    expect(doc).toMatchObject({
      id: "vd3",
      status: "uploaded",
      filename: "passport-v2.pdf",
      targetClientId: "c1",
    });
    expect(doc.filePath).toMatch(/^visas\/v1\//);
    expect(doc.filePath).not.toBe("visas/v1/old-passport.pdf");

    expect(db.storage.uploads[0]).toMatchObject({
      bucket: VISA_DOCUMENTS_BUCKET,
      path: doc.filePath,
      contentType: "application/pdf",
    });
    expect(db.callsFor("visa_documents", "update").at(-1)?.args[0]).toMatchObject({
      status: "uploaded",
      file_path: doc.filePath,
      filename: "passport-v2.pdf",
      mime_type: "application/pdf",
    });
    expect(db.storage.removed).toEqual([
      { bucket: VISA_DOCUMENTS_BUCKET, paths: ["visas/v1/old-passport.pdf"] },
    ]);
    expect(db.callsFor("visa_documents", "select").at(-1)?.args).toEqual(["*"]);
  });

  it("rejects a caller that is not the assigned traveler without mutating the row", async () => {
    seedVisa({ id: "v1" });
    seedDocument({ id: "vd2", target_client_id: "c1", file_path: null, status: "requested" });

    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadVisaDocumentForRequest("vd2", "c-other", file)).rejects.toThrow(
      /not the assigned/i
    );
    expect(db.storage.uploads).toHaveLength(0);
    expect(db.callsFor("visa_documents", "update")).toHaveLength(0);
    expect(db.table("visa_documents")[0]).toMatchObject({ status: "requested", file_path: null });
  });

  it("rejects documents that are not awaiting an upload", async () => {
    seedVisa({ id: "v1" });
    seedDocument({ id: "vd1", target_client_id: "c1", status: "uploaded" });

    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadVisaDocumentForRequest("vd1", "c1", file)).rejects.toThrow(
      /not awaiting an upload/i
    );
    expect(db.storage.uploads).toHaveLength(0);
  });

  it("compensates a failed persistence by removing the just-uploaded object", async () => {
    seedVisa({ id: "v1" });
    seedDocument({ id: "vd2", target_client_id: "c1", file_path: null, status: "requested" });
    db.setWriteError(new Error("database unavailable"));

    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadVisaDocumentForRequest("vd2", "c1", file)).rejects.toThrow(
      "database unavailable"
    );
    expect(db.storage.removed).toEqual([
      { bucket: VISA_DOCUMENTS_BUCKET, paths: [db.storage.uploads[0].path] },
    ]);
  });

  it("retains both failures as an AggregateError when cleanup also fails", async () => {
    seedVisa({ id: "v1" });
    seedDocument({ id: "vd2", target_client_id: "c1", file_path: null, status: "requested" });
    const persistenceError = new Error("database unavailable");
    const cleanupError = new Error("storage unavailable");
    db.setWriteError(persistenceError);
    db.storage.removeError = cleanupError;

    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadVisaDocumentForRequest("vd2", "c1", file)).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof AggregateError &&
        error.errors[0] === persistenceError &&
        error.errors[1] === cleanupError &&
        /cleanup is incomplete/i.test(error.message) &&
        /orphaned/i.test(error.message)
    );
  });
});

describe("visa-documents data layer — agent review operations (Supabase contract)", () => {
  it("markVisaDocumentReviewed reads then updates uploaded -> reviewed", async () => {
    seedDocument({ id: "vd1", status: "uploaded" });

    await markVisaDocumentReviewed("vd1");

    expect(db.callsFor("visa_documents", "select").some((c) => c.args[0] === "*")).toBe(true);
    expect(db.callsFor("visa_documents", "update").at(-1)?.args[0]).toMatchObject({
      status: "reviewed",
    });
    expect(db.table("visa_documents")[0].status).toBe("reviewed");
  });

  it("markVisaDocumentProcessed reads then updates reviewed -> processed", async () => {
    seedDocument({ id: "vd1", status: "reviewed" });

    await markVisaDocumentProcessed("vd1");

    expect(db.callsFor("visa_documents", "update").at(-1)?.args[0]).toMatchObject({
      status: "processed",
    });
  });

  it("requestVisaDocumentReUpload stores the trimmed comment and sets re_upload_requested", async () => {
    seedDocument({ id: "vd1", status: "uploaded" });

    await requestVisaDocumentReUpload("vd1", "  File is blurry, please rescan  ");

    expect(db.callsFor("visa_documents", "update").at(-1)?.args[0]).toMatchObject({
      status: "re_upload_requested",
      agent_comment: "File is blurry, please rescan",
    });
  });

  it("rejects review transitions from invalid source states without writing", async () => {
    seedDocument({ id: "vd1", status: "requested" });

    await expect(markVisaDocumentReviewed("vd1")).rejects.toThrow(/not in \[uploaded\]/);
    await expect(markVisaDocumentProcessed("vd1")).rejects.toThrow(/not in \[reviewed\]/);
    await expect(requestVisaDocumentReUpload("vd1", "Please resend")).rejects.toThrow(
      /not in \[uploaded\]/
    );

    expect(db.callsFor("visa_documents", "update")).toHaveLength(0);
    expect(db.table("visa_documents")[0].status).toBe("requested");
  });

  it("requestVisaDocumentReUpload rejects empty comments before any read", async () => {
    seedDocument({ id: "vd1", status: "uploaded" });

    await expect(requestVisaDocumentReUpload("vd1", "")).rejects.toThrow();
    await expect(requestVisaDocumentReUpload("vd1", "   ")).rejects.toThrow();
    expect(db.callsFor("visa_documents", "select")).toHaveLength(0);
    expect(db.callsFor("visa_documents", "update")).toHaveLength(0);
  });
});

describe("visa-documents data layer — assertVisaDocumentMutable (Supabase contract)", () => {
  it("resolves when the document belongs to the visa", async () => {
    seedDocument({ id: "vd1", visa_id: "v1" });

    await expect(assertVisaDocumentMutable("vd1", "v1")).resolves.toBeUndefined();
    expect(db.callsFor("visa_documents", "select")[0].args).toEqual(["visa_id"]);
    expect(db.callsFor("visa_documents", "eq")[0].args).toEqual(["id", "vd1"]);
  });

  it("maps a cross-visa ownership mismatch to a generic not-found", async () => {
    seedDocument({ id: "vd-other-visa", visa_id: "v2" });

    await expect(assertVisaDocumentMutable("vd-other-visa", "v1")).rejects.toThrow(/not found/i);
    await expect(assertVisaDocumentMutable("vd-missing", "v1")).rejects.toThrow(/not found/i);
    expect(db.callsFor("visa_documents", "update")).toHaveLength(0);
  });
});

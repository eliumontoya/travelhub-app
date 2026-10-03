import { beforeEach, describe, expect, it, vi } from "vitest";

const { isSupabaseConfigured, createClient, getSupabaseAdmin } = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured,
  createClient,
  getSupabaseAdmin,
}));

/**
 * Contract tests (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and `isSupabaseConfigured()` returns true, so the real
 * Supabase branch of `src/lib/data/services.ts` (+ the service-checklist and
 * service-documents modules it re-exports) runs against an in-memory fake that
 * records the exact table/storage call shapes.
 */
const db = vi.hoisted(() => {
  type Row = Record<string, unknown>;
  type Filter = { col: string; value: unknown; op: "eq" | "in" | "is" | "ilike" };
  type Call = { table: string; method: string; args: unknown[] };

  const tables = new Map<string, Row[]>();
  const calls: Call[] = [];
  const NOW = "2026-09-30T11:00:00.000Z";

  const storage = {
    uploads: [] as { bucket: string; path: string; contentType?: string }[],
    removed: [] as { bucket: string; paths: string[] }[],
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
    private returning = false;
    private conflictKeys: string[] | null = null;

    constructor(private tableName: string) {}

    select(cols = "*", opts?: { count?: string }): this {
      calls.push({
        table: this.tableName,
        method: "select",
        args: opts === undefined ? [cols] : [cols, opts],
      });
      if (this.op === "select") this.selectCols = cols;
      else this.returning = true;
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
          const row: Row = { id: crypto.randomUUID(), created_at: NOW, updated_at: NOW, ...data };
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
      } else if (this.returning) {
        result = { data: this.runWrite().map((row) => project(row, this.selectCols)), error: null };
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
          return { data: { path }, error: null };
        },
        async remove(paths: string[]) {
          storage.removed.push({ bucket, paths });
          return { data: null, error: null };
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
      storage.uploads.length = 0;
      storage.removed.length = 0;
      storage.signed.length = 0;
    },
    callsFor(tableName: string, method: string) {
      return calls.filter((call) => call.table === tableName && call.method === method);
    },
  };
});

import {
  addChecklistItem,
  addChecklistItemToTripServices,
  assertServiceUploadMutable,
  deleteChecklistItem,
  ensureServiceForAssignment,
  getServiceChecklistForTrip,
  getServiceDocumentSummariesForTrip,
  getServiceForClientTrip,
  getServiceWithChecklist,
  getServicesProgressForClient,
  hasOwnedServiceRequirements,
  markUploadProcessed,
  markUploadReviewed,
  reorderChecklistItems,
  requestReUpload,
  updateChecklistItem,
  uploadServiceDocument,
} from "@/lib/data/services";

function seedService(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "service-1",
    trip_id: "t1",
    client_id: "c1",
    service_type: "trip_documents",
    status: "active",
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
    ...overrides,
  };
  db.table("services").push(row);
  return row;
}

function seedChecklistItem(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "item-1",
    service_id: "service-1",
    label: "Passport",
    required: true,
    sort_order: 0,
    created_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
    ...overrides,
  };
  db.table("service_checklist_items").push(row);
  return row;
}

function seedUpload(overrides: Record<string, unknown> = {}) {
  const row = {
    id: "upload-1",
    service_id: "service-1",
    checklist_item_id: "item-1",
    file_path: "services/service-1/item-1/file.pdf",
    filename: "file.pdf",
    mime_type: "application/pdf",
    status: "uploaded",
    file_removed: false,
    uploaded_at: "2026-09-30T10:00:00Z",
    updated_at: "2026-09-30T10:00:00Z",
    ...overrides,
  };
  db.table("service_uploads").push(row);
  return row;
}

const file = () => new File(["passport"], "passport.pdf", { type: "application/pdf" });

beforeEach(() => {
  db.reset();
  isSupabaseConfigured.mockReturnValue(true);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  createClient.mockResolvedValue(db.client as never);
  getSupabaseAdmin.mockReturnValue(db.client as never);
  vi.clearAllMocks();
});

describe("services data layer — assignment (Supabase contract)", () => {
  it("upserts one active trip_documents service per assignment", async () => {
    const first = await ensureServiceForAssignment("t1", "c1");
    const second = await ensureServiceForAssignment("t1", "c1");

    expect(first).toMatchObject({
      tripId: "t1",
      clientId: "c1",
      serviceType: "trip_documents",
      status: "active",
    });
    // Idempotency is provided by the ON CONFLICT upsert, not a read-modify-write.
    expect(second.id).toBe(first.id);
    expect(db.table("services")).toHaveLength(1);

    const upsert = db.callsFor("services", "upsert")[0];
    expect(upsert.args[0]).toEqual({
      trip_id: "t1",
      client_id: "c1",
      service_type: "trip_documents",
      status: "active",
    });
    expect(upsert.args[1]).toEqual({ onConflict: "trip_id,client_id,service_type" });
  });

  it("getServiceForClientTrip filters by client, trip, and the default service type", async () => {
    seedService({ id: "service-1", trip_id: "t1", client_id: "c1" });

    const found = await getServiceForClientTrip("c1", "t1");

    expect(found?.id).toBe("service-1");
    expect(db.callsFor("services", "eq").slice(0, 3)).toEqual([
      { table: "services", method: "eq", args: ["client_id", "c1"] },
      { table: "services", method: "eq", args: ["trip_id", "t1"] },
      { table: "services", method: "eq", args: ["service_type", "trip_documents"] },
    ]);
    expect(await getServiceForClientTrip("c2", "t1")).toBeNull();
  });

  it("hasOwnedServiceRequirements checks the scoped service's checklist presence", async () => {
    seedService({ id: "owned", trip_id: "t1", client_id: "c1" });
    seedChecklistItem({ id: "item-1", service_id: "owned" });

    await expect(hasOwnedServiceRequirements("t1", "c1")).resolves.toBe(true);
    await expect(hasOwnedServiceRequirements("t1", "c2")).resolves.toBe(false);
    expect(db.callsFor("service_checklist_items", "eq").at(-1)?.args).toEqual([
      "service_id",
      "owned",
    ]);
    expect(db.callsFor("service_checklist_items", "limit").at(-1)?.args).toEqual([1]);
  });
});

describe("services data layer — checklist (Supabase contract)", () => {
  it("addChecklistItem appends items with increasing sort order", async () => {
    seedService({ id: "service-1" });

    const itemA = await addChecklistItem("service-1", { label: "Passport", required: true });
    const itemB = await addChecklistItem("service-1", { label: "Insurance", required: false });

    expect(itemA).toMatchObject({ label: "Passport", required: true, sortOrder: 0 });
    expect(itemB).toMatchObject({ label: "Insurance", required: false, sortOrder: 1 });
    expect(db.table("service_checklist_items")).toHaveLength(2);

    const insert = db.callsFor("service_checklist_items", "insert")[0];
    expect(insert.args[0]).toEqual({
      service_id: "service-1",
      label: "Passport",
      required: true,
      sort_order: 0,
    });
    // Sort order is derived from the max existing sort_order for the service.
    expect(db.callsFor("service_checklist_items", "order")[0].args).toEqual([
      "sort_order",
      { ascending: false },
    ]);
  });

  it("addChecklistItem rejects an empty label before writing", async () => {
    await expect(addChecklistItem("service-1", { label: "   " })).rejects.toThrow(/label/i);
    expect(db.callsFor("service_checklist_items", "insert")).toHaveLength(0);
  });

  it("updateChecklistItem patches label, required, and updated_at", async () => {
    seedChecklistItem({ id: "item-1", label: "Passport", required: true });

    await updateChecklistItem("item-1", { label: "Passport copy", required: false });

    const update = db.callsFor("service_checklist_items", "update").at(-1);
    expect(update?.args[0]).toMatchObject({ label: "Passport copy", required: false });
    expect(typeof (update?.args[0] as Record<string, unknown>).updated_at).toBe("string");
    expect(db.table("service_checklist_items")[0]).toMatchObject({
      label: "Passport copy",
      required: false,
    });
  });

  it("reorderChecklistItems updates each item's position scoped to the service", async () => {
    seedChecklistItem({ id: "a", sort_order: 0 });
    seedChecklistItem({ id: "b", sort_order: 1 });
    seedChecklistItem({ id: "c", sort_order: 2 });

    await reorderChecklistItems("service-1", ["c", "a", "b"]);

    const orders = new Map(db.table("service_checklist_items").map((i) => [i.id, i.sort_order]));
    expect(orders.get("c")).toBe(0);
    expect(orders.get("a")).toBe(1);
    expect(orders.get("b")).toBe(2);
    expect(db.callsFor("service_checklist_items", "update")).toHaveLength(3);
    expect(db.callsFor("service_checklist_items", "eq")).toContainEqual(
      expect.objectContaining({ args: ["service_id", "service-1"] })
    );
  });

  it("deleteChecklistItem removes its uploads (storage + rows) then the item", async () => {
    seedChecklistItem({ id: "item-1", service_id: "service-1" });
    seedUpload({ id: "upload-1", checklist_item_id: "item-1", file_path: "services/x.pdf" });

    await deleteChecklistItem("item-1");

    expect(db.storage.removed).toEqual([{ bucket: "trip-documents", paths: ["services/x.pdf"] }]);
    expect(db.table("service_uploads")).toHaveLength(0);
    expect(db.table("service_checklist_items")).toHaveLength(0);
    expect(db.callsFor("service_uploads", "delete")[0].args).toEqual([]);
    expect(db.callsFor("service_uploads", "eq").at(-1)?.args).toEqual(["checklist_item_id", "item-1"]);
    expect(db.callsFor("service_checklist_items", "delete")[0].args).toEqual([]);
  });

  it("addChecklistItemToTripServices creates an independent item for every active service", async () => {
    seedService({ id: "service-1", trip_id: "t1" });
    seedService({ id: "service-2", trip_id: "t1", client_id: "c2" });

    const created = await addChecklistItemToTripServices("t1", {
      label: "Passport copy",
      required: true,
    });

    expect(created).toHaveLength(2);
    expect(created.map((item) => item.serviceId).sort()).toEqual(["service-1", "service-2"]);
    expect(new Set(created.map((item) => item.id)).size).toBe(2);
    const insert = db.callsFor("service_checklist_items", "insert").at(-1);
    expect(insert?.args[0]).toEqual([
      { service_id: "service-1", label: "Passport copy", required: true, sort_order: 0 },
      { service_id: "service-2", label: "Passport copy", required: true, sort_order: 0 },
    ]);
  });

  it("addChecklistItemToTripServices validates every target before writing", async () => {
    seedService({ id: "service-1", trip_id: "t1", status: "inactive" });

    await expect(
      addChecklistItemToTripServices("t1", { label: "Passport copy", required: true })
    ).rejects.toThrow("No todos los servicios del viaje están disponibles");
    expect(db.callsFor("service_checklist_items", "insert")).toHaveLength(0);
  });

  it("addChecklistItemToTripServices rejects a trip without services", async () => {
    await expect(
      addChecklistItemToTripServices("t1", { label: "Passport copy", required: true })
    ).rejects.toThrow("El viaje no tiene servicios disponibles");
    expect(db.callsFor("service_checklist_items", "insert")).toHaveLength(0);
  });

  it("getServiceChecklistForTrip scopes the service to the trip", async () => {
    seedService({ id: "owned", trip_id: "t1", client_id: "c1" });
    seedChecklistItem({ id: "item-1", service_id: "owned", label: "Passport" });
    seedService({ id: "foreign", trip_id: "t2", client_id: "c2" });

    await expect(getServiceChecklistForTrip("t1", "owned")).resolves.toMatchObject({
      id: "owned",
      items: [{ label: "Passport" }],
    });
    await expect(getServiceChecklistForTrip("t1", "foreign")).rejects.toThrow(
      "El servicio no pertenece al viaje"
    );
  });
});

describe("services data layer — uploads and review states (Supabase contract)", () => {
  it("uploadServiceDocument rejects a checklist item that belongs to another service", async () => {
    seedChecklistItem({ id: "item-1", service_id: "service-2" });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toThrow(
      "El item no pertenece al servicio"
    );
    expect(db.storage.uploads).toHaveLength(0);
    expect(db.callsFor("service_uploads", "upsert")).toHaveLength(0);
  });

  it("uploadServiceDocument upserts one row per checklist item and persists under services/", async () => {
    seedService({ id: "service-1" });
    seedChecklistItem({ id: "item-1", service_id: "service-1" });

    const first = await uploadServiceDocument("service-1", "item-1", file());
    const second = await uploadServiceDocument("service-1", "item-1", file());

    expect(first.status).toBe("uploaded");
    expect(second.filename).toBe("passport.pdf");
    expect(db.table("service_uploads")).toHaveLength(1);
    expect(db.table("service_uploads")[0].id).toBe(second.id);
    expect(second.filePath).toContain("services/");

    const upsert = db.callsFor("service_uploads", "upsert").at(-1);
    expect(upsert?.args[1]).toEqual({ onConflict: "service_id,checklist_item_id" });
    expect(db.storage.uploads[0]).toMatchObject({ bucket: "trip-documents" });
  });

  it("markUploadReviewed sets reviewed without removing the file", async () => {
    seedUpload({ id: "upload-1", status: "uploaded" });

    await markUploadReviewed("upload-1");

    expect(db.callsFor("service_uploads", "update").at(-1)?.args[0]).toMatchObject({
      status: "reviewed",
      file_removed: false,
    });
    expect(db.storage.removed).toHaveLength(0);
    expect(db.table("service_uploads")[0]).toMatchObject({ status: "reviewed", file_removed: false });
  });

  it("markUploadProcessed removes the stored file then flags file_removed", async () => {
    seedUpload({ id: "upload-1", file_path: "services/keep.pdf", status: "reviewed" });

    await markUploadProcessed("upload-1");

    expect(db.storage.removed).toEqual([{ bucket: "trip-documents", paths: ["services/keep.pdf"] }]);
    expect(db.callsFor("service_uploads", "update").at(-1)?.args[0]).toMatchObject({
      status: "processed",
      file_removed: true,
    });
  });

  it("requestReUpload rejects empty comments and stores trimmed comments otherwise", async () => {
    seedUpload({ id: "upload-1", status: "uploaded" });

    await expect(requestReUpload("upload-1", "")).rejects.toThrow(/comentario/i);
    await expect(requestReUpload("upload-1", "   ")).rejects.toThrow(/comentario/i);
    expect(db.callsFor("service_uploads", "update")).toHaveLength(0);

    await requestReUpload("upload-1", "  File is blurry  ");
    expect(db.callsFor("service_uploads", "update").at(-1)?.args[0]).toMatchObject({
      status: "re_upload_requested",
      agent_comment: "File is blurry",
    });
  });

  it("getServiceWithChecklist assembles items with a signed upload url", async () => {
    seedService({ id: "service-1" });
    seedChecklistItem({ id: "item-1", service_id: "service-1", sort_order: 0 });
    seedUpload({
      id: "upload-1",
      service_id: "service-1",
      checklist_item_id: "item-1",
      file_path: "services/service-1/item-1/file.pdf",
    });

    const service = await getServiceWithChecklist("service-1");

    expect(service.id).toBe("service-1");
    expect(service.items).toHaveLength(1);
    expect(service.items[0]).toMatchObject({
      id: "item-1",
      upload: { id: "upload-1", url: expect.stringMatching(/^https:\/\/signed\.example\//) },
    });
    expect(db.storage.signed).toEqual([
      {
        bucket: "trip-documents",
        path: "services/service-1/item-1/file.pdf",
        expiresIn: 3600,
      },
    ]);
  });
});

describe("services data layer — client progress (Supabase contract)", () => {
  it("getServicesProgressForClient counts reviewed/processed uploads against total items", async () => {
    seedService({ id: "service-1", client_id: "c1" });
    seedChecklistItem({ id: "a", service_id: "service-1" });
    seedChecklistItem({ id: "b", service_id: "service-1" });
    seedChecklistItem({ id: "c", service_id: "service-1" });
    seedUpload({ id: "u-a", checklist_item_id: "a", status: "reviewed" });
    seedUpload({ id: "u-b", checklist_item_id: "b", status: "uploaded" });
    seedUpload({ id: "u-c", checklist_item_id: "c", status: "processed" });

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get("service-1")).toEqual({ completed: 2, total: 3 });
    expect(db.callsFor("services", "eq").slice(0, 2)).toEqual([
      { table: "services", method: "eq", args: ["client_id", "c1"] },
      { table: "services", method: "eq", args: ["service_type", "trip_documents"] },
    ]);
    expect(db.callsFor("service_uploads", "in")).toContainEqual(
      expect.objectContaining({ args: ["status", ["reviewed", "processed"]] })
    );
  });

  it("getServiceDocumentSummariesForTrip separates processed from awaiting review", async () => {
    seedService({ id: "service-1", trip_id: "t1", client_id: "c1" });
    seedChecklistItem({ id: "a", service_id: "service-1" });
    seedChecklistItem({ id: "b", service_id: "service-1" });
    seedChecklistItem({ id: "c", service_id: "service-1" });
    seedUpload({ id: "u-a", checklist_item_id: "a", status: "reviewed" });
    seedUpload({ id: "u-b", checklist_item_id: "b", status: "uploaded" });
    seedUpload({ id: "u-c", checklist_item_id: "c", status: "re_upload_requested" });

    await expect(getServiceDocumentSummariesForTrip("t1")).resolves.toEqual([
      { serviceId: "service-1", clientId: "c1", processed: 1, total: 3, awaitingReview: 1 },
    ]);
    expect(db.callsFor("services", "order")[0].args).toEqual(["created_at", { ascending: true }]);
  });
});

describe("services data layer — admin client routing", () => {
  it("getServiceWithChecklist uses the service-role admin client, not the anon client", async () => {
    getSupabaseAdmin.mockImplementation(() => {
      throw new Error("ADMIN_CLIENT_USED");
    });

    await expect(getServiceWithChecklist("svc1")).rejects.toThrow("ADMIN_CLIENT_USED");
    expect(getSupabaseAdmin).toHaveBeenCalledTimes(1);
  });
});

type ServiceUploadScenario = {
  existingPath?: string;
  persistenceError?: Error;
  cleanupError?: Error;
  cleanupThrows?: boolean;
};

function createServiceUploadClient({
  existingPath,
  persistenceError,
  cleanupError,
  cleanupThrows,
}: ServiceUploadScenario) {
  const events: string[] = [];
  const paths = { uploaded: "", removed: [] as string[] };

  const client = {
    from(table: string) {
      if (table === "service_checklist_items") {
        const query = {
          select: () => query,
          eq: () => query,
          maybeSingle: async () => ({
            data: { id: "item-1", service_id: "service-1" },
            error: null,
          }),
        };
        return query;
      }

      const existingUploadQuery = {
        select: () => existingUploadQuery,
        eq: () => existingUploadQuery,
        maybeSingle: async () => ({
          data: existingPath ? { file_path: existingPath } : null,
          error: null,
        }),
      };
      const upsertQuery = {
        select: () => upsertQuery,
        single: async () => {
          events.push("upsert");
          if (persistenceError) return { data: null, error: persistenceError };
          return {
            data: {
              id: "upload-2",
              service_id: "service-1",
              checklist_item_id: "item-1",
              file_path: paths.uploaded,
              filename: "passport.pdf",
              mime_type: "application/pdf",
              status: "uploaded",
              file_removed: false,
              uploaded_at: "2026-01-01T00:00:00.000Z",
              updated_at: "2026-01-01T00:00:00.000Z",
            },
            error: null,
          };
        },
      };

      return {
        select: () => existingUploadQuery,
        upsert: () => upsertQuery,
      };
    },
    storage: {
      from: () => ({
        upload: async (path: string) => {
          paths.uploaded = path;
          events.push(`upload:${path}`);
          return { error: null };
        },
        remove: async (removedPaths: string[]) => {
          paths.removed.push(...removedPaths);
          events.push(`remove:${removedPaths.join(",")}`);
          if (cleanupThrows && cleanupError) throw cleanupError;
          return { error: cleanupError ?? null };
        },
      }),
    },
  };

  return { client, events, paths };
}

describe("uploadServiceDocument (Supabase mode)", () => {
  function useSupabaseClient(scenario: ServiceUploadScenario) {
    const harness = createServiceUploadClient(scenario);
    getSupabaseAdmin.mockReturnValue(harness.client as never);
    return harness;
  }

  it("compensates a failed first-upload persistence with only the provisional path", async () => {
    const persistenceError = new Error("database unavailable");
    const { paths } = useSupabaseClient({ persistenceError });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toBe(persistenceError);

    expect(paths.removed).toEqual([paths.uploaded]);
    expect(paths.removed).toHaveLength(1);
  });

  it("preserves the existing replacement path when persistence fails", async () => {
    const persistenceError = new Error("database unavailable");
    const { paths } = useSupabaseClient({
      existingPath: "services/service-1/item-1/old.pdf",
      persistenceError,
    });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toBe(persistenceError);

    expect(paths.removed).toEqual([paths.uploaded]);
    expect(paths.removed).not.toContain("services/service-1/item-1/old.pdf");
  });

  it("retains both failures when compensation returns an error", async () => {
    const persistenceError = new Error("database unavailable");
    const cleanupError = new Error("storage unavailable");
    const { paths } = useSupabaseClient({ persistenceError, cleanupError });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof AggregateError &&
          error.errors[0] === persistenceError &&
          error.errors[1] === cleanupError &&
          /cleanup is incomplete/i.test(error.message) &&
          /orphaned/i.test(error.message) &&
          error.message.includes(paths.uploaded)
        );
      }
    );
  });

  it("retains both failures when compensation throws", async () => {
    const persistenceError = new Error("database unavailable");
    const cleanupError = new Error("storage unavailable");
    const { paths } = useSupabaseClient({
      persistenceError,
      cleanupError,
      cleanupThrows: true,
    });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toSatisfy(
      (error: unknown) => {
        return (
          error instanceof AggregateError &&
          error.errors[0] === persistenceError &&
          error.errors[1] === cleanupError &&
          /cleanup is incomplete/i.test(error.message) &&
          /orphaned/i.test(error.message) &&
          error.message.includes(paths.uploaded)
        );
      }
    );
  });

  it("updates the row before removing the old replacement path", async () => {
    const oldPath = "services/service-1/item-1/old.pdf";
    const { events, paths } = useSupabaseClient({ existingPath: oldPath });

    const upload = await uploadServiceDocument("service-1", "item-1", file());

    expect(upload.filePath).toBe(paths.uploaded);
    expect(paths.removed).toEqual([oldPath]);
    expect(events.indexOf("upsert")).toBeLessThan(events.indexOf(`remove:${oldPath}`));
    expect(paths.removed).not.toContain(paths.uploaded);
  });
});

type TableResponses = Record<string, { data: unknown; error: unknown }>;

function buildSupabaseChain(responses: TableResponses) {
  const from = vi.fn((table: string) => {
    const response = responses[table] ?? { data: null, error: null };
    const maybeSingle = vi.fn(() => Promise.resolve(response));
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    return { select };
  });
  return { from };
}

function setupAdminClient(responses: TableResponses) {
  isSupabaseConfigured.mockReturnValue(true);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  getSupabaseAdmin.mockReturnValue(
    buildSupabaseChain(responses) as unknown as ReturnType<typeof getSupabaseAdmin>
  );
}

describe("assertServiceUploadMutable (service-role guard)", () => {
  it("resolves when the upload, service, and trip all line up", async () => {
    setupAdminClient({
      service_uploads: { data: { service_id: "svc-1" }, error: null },
      services: { data: { trip_id: "trip-1" }, error: null },
      trips: { data: { status: "active" }, error: null },
    });

    await expect(assertServiceUploadMutable("up-1", "trip-1")).resolves.toBeUndefined();
  });

  it("throws 'Upload no encontrado' when the upload row is missing", async () => {
    setupAdminClient({
      service_uploads: { data: null, error: null },
      services: { data: { trip_id: "trip-1" }, error: null },
      trips: { data: { status: "active" }, error: null },
    });

    await expect(assertServiceUploadMutable("up-missing", "trip-1")).rejects.toThrow(
      "Upload no encontrado"
    );
  });

  it("throws 'Servicio no encontrado' when the service row is missing", async () => {
    setupAdminClient({
      service_uploads: { data: { service_id: "svc-missing" }, error: null },
      services: { data: null, error: null },
      trips: { data: { status: "active" }, error: null },
    });

    await expect(assertServiceUploadMutable("up-1", "trip-1")).rejects.toThrow(
      "Servicio no encontrado"
    );
  });

  it("throws 'Upload no encontrado' on cross-trip ownership mismatch", async () => {
    setupAdminClient({
      service_uploads: { data: { service_id: "svc-1" }, error: null },
      services: { data: { trip_id: "trip-other" }, error: null },
      trips: { data: { status: "active" }, error: null },
    });

    await expect(assertServiceUploadMutable("up-1", "trip-1")).rejects.toThrow(
      "Upload no encontrado"
    );
  });

  it("throws 'El viaje archivado es de solo lectura' when the trip is archived", async () => {
    setupAdminClient({
      service_uploads: { data: { service_id: "svc-1" }, error: null },
      services: { data: { trip_id: "trip-1" }, error: null },
      trips: { data: { status: "archived" }, error: null },
    });

    await expect(assertServiceUploadMutable("up-1", "trip-1")).rejects.toThrow(
      "El viaje archivado es de solo lectura"
    );
  });

  it("rethrows raw query errors from the upload lookup", async () => {
    setupAdminClient({
      service_uploads: { data: null, error: new Error("db down") },
      services: { data: { trip_id: "trip-1" }, error: null },
      trips: { data: { status: "active" }, error: null },
    });

    await expect(assertServiceUploadMutable("up-1", "trip-1")).rejects.toThrow("db down");
  });

  it("resolves when the trip row is missing but not archived", async () => {
    // No archived status means the guard accepts the absence (matches the
    // Server-Action behaviour where a missing trip row is treated as a
    // non-archived trip rather than throwing).
    setupAdminClient({
      service_uploads: { data: { service_id: "svc-1" }, error: null },
      services: { data: { trip_id: "trip-1" }, error: null },
      trips: { data: null, error: null },
    });

    await expect(assertServiceUploadMutable("up-1", "trip-1")).resolves.toBeUndefined();
  });
});

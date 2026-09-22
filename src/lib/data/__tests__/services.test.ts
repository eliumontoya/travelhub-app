import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addChecklistItem,
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
  addChecklistItemToTripServices,
  updateChecklistItem,
  uploadServiceDocument,
} from "@/lib/data/services";
import {
  mockServiceChecklistItems,
  mockServices,
  mockServiceUploads,
} from "@/lib/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

import { isSupabaseConfigured, getSupabaseAdmin } from "@/lib/supabase/server";

function resetServiceMocks() {
  mockServices.length = 0;
  mockServiceChecklistItems.length = 0;
  mockServiceUploads.length = 0;
}

beforeEach(() => {
  resetServiceMocks();
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  vi.clearAllMocks();
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
          maybeSingle: async () => ({ data: { id: "item-1", service_id: "service-1" }, error: null }),
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

describe("services data layer (mock mode)", () => {
  it("ensureServiceForAssignment creates one service and is idempotent", async () => {
    const first = await ensureServiceForAssignment("t1", "c1");
    const second = await ensureServiceForAssignment("t1", "c1");

    expect(first.id).toBe(second.id);
    expect(mockServices).toHaveLength(1);
    expect(first.tripId).toBe("t1");
    expect(first.clientId).toBe("c1");
    expect(first.serviceType).toBe("trip_documents");
    expect(first.status).toBe("active");
  });

  it("getServiceForClientTrip returns the matching service", async () => {
    const created = await ensureServiceForAssignment("t1", "c1");
    const found = await getServiceForClientTrip("c1", "t1");

    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it("addChecklistItem appends items with increasing sort order", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");

    const itemA = await addChecklistItem(service.id, { label: "Passport", required: true });
    const itemB = await addChecklistItem(service.id, { label: "Insurance", required: false });

    expect(itemA.label).toBe("Passport");
    expect(itemA.required).toBe(true);
    expect(itemA.sortOrder).toBe(0);
    expect(itemB.sortOrder).toBe(1);
    expect(mockServiceChecklistItems).toHaveLength(2);
  });

  it("deleteChecklistItem removes the item and its upload record", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    await uploadServiceDocument(service.id, item.id, file);

    await deleteChecklistItem(item.id);

    expect(mockServiceChecklistItems).toHaveLength(0);
    expect(mockServiceUploads).toHaveLength(0);
  });

  it("reorderChecklistItems persists the requested order", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const itemA = await addChecklistItem(service.id, { label: "A", required: true });
    const itemB = await addChecklistItem(service.id, { label: "B", required: true });
    const itemC = await addChecklistItem(service.id, { label: "C", required: true });

    await reorderChecklistItems(service.id, [itemC.id, itemA.id, itemB.id]);

    const orders = new Map(mockServiceChecklistItems.map((i) => [i.id, i.sortOrder]));
    expect(orders.get(itemC.id)).toBe(0);
    expect(orders.get(itemA.id)).toBe(1);
    expect(orders.get(itemB.id)).toBe(2);
  });

  it("uploadServiceDocument upserts one record per checklist item", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });
    const firstFile = new File(["a"], "passport.pdf", { type: "application/pdf" });
    const secondFile = new File(["b"], "passport2.pdf", { type: "application/pdf" });

    const firstUpload = await uploadServiceDocument(service.id, item.id, firstFile);
    const secondUpload = await uploadServiceDocument(service.id, item.id, secondFile);

    expect(firstUpload.status).toBe("uploaded");
    expect(secondUpload.status).toBe("uploaded");
    expect(secondUpload.filename).toBe("passport2.pdf");
    expect(mockServiceUploads).toHaveLength(1);
    expect(mockServiceUploads[0].id).toBe(secondUpload.id);
    expect(mockServiceUploads[0].filePath).toContain("services/");
  });

  it("markUploadReviewed sets status reviewed without removing the file", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const upload = await uploadServiceDocument(service.id, item.id, file);

    await markUploadReviewed(upload.id);

    const updated = mockServiceUploads.find((u) => u.id === upload.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("reviewed");
    expect(updated!.fileRemoved).toBe(false);
  });

  it("requestReUpload rejects empty or whitespace-only comments", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const upload = await uploadServiceDocument(service.id, item.id, file);

    await expect(requestReUpload(upload.id, "")).rejects.toThrow();
    await expect(requestReUpload(upload.id, "   ")).rejects.toThrow();
  });

  it("requestReUpload stores comment and status re_upload_requested", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const upload = await uploadServiceDocument(service.id, item.id, file);

    await requestReUpload(upload.id, "File is blurry");

    const updated = mockServiceUploads.find((u) => u.id === upload.id);
    expect(updated!.status).toBe("re_upload_requested");
    expect(updated!.agentComment).toBe("File is blurry");
  });

  it("getServicesProgressForClient counts reviewed and processed uploads", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const itemA = await addChecklistItem(service.id, { label: "A", required: true });
    const itemB = await addChecklistItem(service.id, { label: "B", required: true });
    const itemC = await addChecklistItem(service.id, { label: "C", required: true });

    const processedFile = new File(["x"], "a.pdf", { type: "application/pdf" });
    const uploadedFile = new File(["x"], "b.pdf", { type: "application/pdf" });
    const processedUpload = await uploadServiceDocument(service.id, itemA.id, processedFile);
    await uploadServiceDocument(service.id, itemB.id, uploadedFile);
    await markUploadReviewed(processedUpload.id);

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get(service.id)).toEqual({ completed: 1, total: 3 });
  });

  it("summarizes processed and uploaded work without counting re-upload requests", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const processed = await addChecklistItem(service.id, { label: "Passport", required: true });
    const uploaded = await addChecklistItem(service.id, { label: "Visa", required: true });
    const requested = await addChecklistItem(service.id, { label: "Insurance", required: false });

    const processedUpload = await uploadServiceDocument(
      service.id,
      processed.id,
      new File(["x"], "passport.pdf", { type: "application/pdf" })
    );
    await uploadServiceDocument(
      service.id,
      uploaded.id,
      new File(["x"], "visa.pdf", { type: "application/pdf" })
    );
    const requestedUpload = await uploadServiceDocument(
      service.id,
      requested.id,
      new File(["x"], "insurance.pdf", { type: "application/pdf" })
    );
    await markUploadReviewed(processedUpload.id);
    await requestReUpload(requestedUpload.id, "Please upload a clearer scan");

    await expect(getServiceDocumentSummariesForTrip("t1")).resolves.toEqual([
      {
        serviceId: service.id,
        clientId: "c1",
        processed: 1,
        total: 3,
        awaitingReview: 1,
      },
    ]);
  });

  it("keeps owned presence and checklist detail scoped to the trip", async () => {
    const owned = await ensureServiceForAssignment("t1", "c1");
    const foreign = await ensureServiceForAssignment("t2", "c2");
    await addChecklistItem(owned.id, { label: "Passport", required: true });
    await addChecklistItem(foreign.id, { label: "Visa", required: true });

    await expect(hasOwnedServiceRequirements("t1", "c1")).resolves.toBe(true);
    await expect(hasOwnedServiceRequirements("t1", "c2")).resolves.toBe(false);
    await expect(getServiceChecklistForTrip("t1", owned.id)).resolves.toMatchObject({
      id: owned.id,
      items: [{ label: "Passport" }],
    });
    await expect(getServiceChecklistForTrip("t1", foreign.id)).rejects.toThrow(
      "El servicio no pertenece al viaje"
    );
  });

  it("bulk assignment creates an independent item for every valid service", async () => {
    const first = await ensureServiceForAssignment("t1", "c1");
    const second = await ensureServiceForAssignment("t1", "c2");

    const created = await addChecklistItemToTripServices("t1", {
      label: "Passport copy",
      required: true,
    });

    expect(created).toHaveLength(2);
    expect(created.map((item) => item.serviceId).sort()).toEqual([first.id, second.id].sort());
    expect(mockServiceChecklistItems).toHaveLength(2);
    expect(new Set(created.map((item) => item.id)).size).toBe(2);
  });

  it("bulk assignment validates every target before writing", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    service.status = "inactive";

    await expect(
      addChecklistItemToTripServices("t1", { label: "Passport copy", required: true })
    ).rejects.toThrow("No todos los servicios del viaje están disponibles");
    expect(mockServiceChecklistItems).toHaveLength(0);
  });

  it("updateChecklistItem edits the label and toggles required", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });

    await updateChecklistItem(item.id, { label: "Passport copy", required: false });

    const updated = mockServiceChecklistItems.find((i) => i.id === item.id);
    expect(updated).toBeDefined();
    expect(updated!.label).toBe("Passport copy");
    expect(updated!.required).toBe(false);
  });

  it("ensureServiceForAssignment is idempotent under concurrent duplicate requests", async () => {
    const [first, second] = await Promise.all([
      ensureServiceForAssignment("t1", "c1"),
      ensureServiceForAssignment("t1", "c1"),
    ]);

    expect(first.id).toBe(second.id);
    expect(mockServices).toHaveLength(1);
  });

  it("getServiceWithChecklist uses the service-role admin client, not the anon client", async () => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.mocked(getSupabaseAdmin).mockImplementation(() => {
      throw new Error("ADMIN_CLIENT_USED");
    });

    await expect(getServiceWithChecklist("svc1")).rejects.toThrow("ADMIN_CLIENT_USED");
    expect(getSupabaseAdmin).toHaveBeenCalledTimes(1);
  });
});

describe("uploadServiceDocument (Supabase mode)", () => {
  function useSupabaseClient(scenario: ServiceUploadScenario) {
    const harness = createServiceUploadClient(scenario);
    vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
    vi.mocked(getSupabaseAdmin).mockReturnValue(harness.client as never);
    return harness;
  }

  const file = () => new File(["passport"], "passport.pdf", { type: "application/pdf" });

  it("compensates a failed first-upload persistence with only the provisional path", async () => {
    const persistenceError = new Error("database unavailable");
    const { paths } = useSupabaseClient({ persistenceError });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toBe(persistenceError);

    expect(paths.removed).toEqual([paths.uploaded]);
    expect(paths.removed).toHaveLength(1);
  });

  it("preserves the existing replacement path when persistence fails", async () => {
    const persistenceError = new Error("database unavailable");
    const { paths } = useSupabaseClient({ existingPath: "services/service-1/item-1/old.pdf", persistenceError });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toBe(persistenceError);

    expect(paths.removed).toEqual([paths.uploaded]);
    expect(paths.removed).not.toContain("services/service-1/item-1/old.pdf");
  });

  it("retains both failures when compensation returns an error", async () => {
    const persistenceError = new Error("database unavailable");
    const cleanupError = new Error("storage unavailable");
    const { paths } = useSupabaseClient({ persistenceError, cleanupError });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toSatisfy((error: unknown) => {
      return error instanceof AggregateError
        && error.errors[0] === persistenceError
        && error.errors[1] === cleanupError
        && /cleanup is incomplete/i.test(error.message)
        && /orphaned/i.test(error.message)
        && error.message.includes(paths.uploaded);
    });
  });

  it("retains both failures when compensation throws", async () => {
    const persistenceError = new Error("database unavailable");
    const cleanupError = new Error("storage unavailable");
    const { paths } = useSupabaseClient({ persistenceError, cleanupError, cleanupThrows: true });

    await expect(uploadServiceDocument("service-1", "item-1", file())).rejects.toSatisfy((error: unknown) => {
      return error instanceof AggregateError
        && error.errors[0] === persistenceError
        && error.errors[1] === cleanupError
        && /cleanup is incomplete/i.test(error.message)
        && /orphaned/i.test(error.message)
        && error.message.includes(paths.uploaded);
    });
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
  vi.mocked(isSupabaseConfigured).mockReturnValue(true);
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  vi.mocked(getSupabaseAdmin).mockReturnValue(buildSupabaseChain(responses) as unknown as ReturnType<typeof getSupabaseAdmin>);
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

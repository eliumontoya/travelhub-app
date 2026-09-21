import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addChecklistItem,
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
  vi.clearAllMocks();
});

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

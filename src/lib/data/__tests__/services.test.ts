import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addChecklistItem,
  deleteChecklistItem,
  ensureServiceForAssignment,
  getServiceForClientTrip,
  getServicesProgressForClient,
  markUploadProcessed,
  reorderChecklistItems,
  requestReUpload,
  uploadServiceDocument,
} from "@/lib/data/services";
import {
  mockServiceChecklistItems,
  mockServices,
  mockServiceUploads,
} from "@/lib/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

function resetServiceMocks() {
  mockServices.length = 0;
  mockServiceChecklistItems.length = 0;
  mockServiceUploads.length = 0;
}

beforeEach(resetServiceMocks);

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

  it("markUploadProcessed sets status processed and file_removed", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const item = await addChecklistItem(service.id, { label: "Passport", required: true });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const upload = await uploadServiceDocument(service.id, item.id, file);

    await markUploadProcessed(upload.id);

    const updated = mockServiceUploads.find((u) => u.id === upload.id);
    expect(updated).toBeDefined();
    expect(updated!.status).toBe("processed");
    expect(updated!.fileRemoved).toBe(true);
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

  it("getServicesProgressForClient counts only processed uploads", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const itemA = await addChecklistItem(service.id, { label: "A", required: true });
    const itemB = await addChecklistItem(service.id, { label: "B", required: true });
    const itemC = await addChecklistItem(service.id, { label: "C", required: true });

    const processedFile = new File(["x"], "a.pdf", { type: "application/pdf" });
    const uploadedFile = new File(["x"], "b.pdf", { type: "application/pdf" });
    const processedUpload = await uploadServiceDocument(service.id, itemA.id, processedFile);
    await uploadServiceDocument(service.id, itemB.id, uploadedFile);
    await markUploadProcessed(processedUpload.id);

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get(service.id)).toEqual({ completed: 1, total: 3 });
  });
});

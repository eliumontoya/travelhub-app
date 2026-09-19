import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addChecklistItem,
  ensureServiceForAssignment,
  getServicesProgressForClient,
  markUploadProcessed,
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

describe("client portal data layer (mock mode)", () => {
  it("uploadServiceDocument rejects a checklist item that belongs to another service", async () => {
    const serviceForClientA = await ensureServiceForAssignment("t1", "c1");
    const serviceForClientB = await ensureServiceForAssignment("t1", "c2");
    const itemForClientA = await addChecklistItem(serviceForClientA.id, {
      label: "Passport",
      required: true,
    });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(
      uploadServiceDocument(serviceForClientB.id, itemForClientA.id, file)
    ).rejects.toThrow("El item no pertenece al servicio");
  });

  it("getServicesProgressForClient returns {completed, total} keyed by service", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    await addChecklistItem(service.id, { label: "A", required: true });
    await addChecklistItem(service.id, { label: "B", required: true });

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get(service.id)).toEqual({ completed: 0, total: 2 });
  });

  it("progress count only treats processed uploads as completed", async () => {
    const service = await ensureServiceForAssignment("t1", "c1");
    const itemA = await addChecklistItem(service.id, { label: "A", required: true });
    const itemB = await addChecklistItem(service.id, { label: "B", required: true });
    const itemC = await addChecklistItem(service.id, { label: "C", required: true });

    const processedFile = new File(["x"], "a.pdf", { type: "application/pdf" });
    const uploadedFile = new File(["x"], "b.pdf", { type: "application/pdf" });
    const reUploadFile = new File(["x"], "c.pdf", { type: "application/pdf" });

    const processedUpload = await uploadServiceDocument(service.id, itemA.id, processedFile);
    await uploadServiceDocument(service.id, itemB.id, uploadedFile);
    const reUploadUpload = await uploadServiceDocument(service.id, itemC.id, reUploadFile);
    await markUploadProcessed(processedUpload.id);
    // Simulate agent requesting re-upload without mutating checklist
    const stored = mockServiceUploads.find((u) => u.id === reUploadUpload.id);
    if (stored) {
      stored.status = "re_upload_requested";
      stored.agentComment = "File is blurry";
    }

    const progress = await getServicesProgressForClient("c1");

    expect(progress.get(service.id)).toEqual({ completed: 1, total: 3 });
  });
});

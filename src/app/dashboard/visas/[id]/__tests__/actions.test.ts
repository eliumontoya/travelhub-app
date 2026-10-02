import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks must be registered before importing the module under test.
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

const requireRoleMock = vi.fn();
const requireFeatureMock = vi.fn();
vi.mock("@/lib/auth/roles", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
  requireFeature: (...args: unknown[]) => requireFeatureMock(...args),
}));

const updateVisaMock = vi.fn();
const setVisaClientsMock = vi.fn();
const transitionVisaStatusMock = vi.fn();
const uploadVisaDocumentMock = vi.fn();
const requestVisaDocumentMock = vi.fn();
const markVisaDocumentReviewedMock = vi.fn();
const markVisaDocumentProcessedMock = vi.fn();
const requestVisaDocumentReUploadMock = vi.fn();
vi.mock("@/lib/data", () => ({
  updateVisa: (...args: unknown[]) => updateVisaMock(...args),
  setVisaClients: (...args: unknown[]) => setVisaClientsMock(...args),
  transitionVisaStatus: (...args: unknown[]) => transitionVisaStatusMock(...args),
  uploadVisaDocument: (...args: unknown[]) => uploadVisaDocumentMock(...args),
  requestVisaDocument: (...args: unknown[]) => requestVisaDocumentMock(...args),
  markVisaDocumentReviewed: (...args: unknown[]) => markVisaDocumentReviewedMock(...args),
  markVisaDocumentProcessed: (...args: unknown[]) => markVisaDocumentProcessedMock(...args),
  requestVisaDocumentReUpload: (...args: unknown[]) =>
    requestVisaDocumentReUploadMock(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import * as actions from "../actions";

beforeEach(() => {
  vi.clearAllMocks();
  // Default happy path: caller is an authorized agent with the visas feature.
  requireRoleMock.mockResolvedValue("agent");
  requireFeatureMock.mockResolvedValue({
    id: "agent-1",
    role: "agent",
    features: ["visas"],
  });
});

describe("dashboard visa detail actions — export surface", () => {
  it("exports the mutable-field, client-management, status, and document actions", () => {
    expect(typeof actions.updateVisaAction).toBe("function");
    expect(typeof actions.setVisaClientsAction).toBe("function");
    expect(typeof actions.transitionVisaStatusAction).toBe("function");
    expect(typeof actions.uploadVisaDocumentAction).toBe("function");
    expect(typeof actions.requestVisaDocumentAction).toBe("function");
    expect(typeof actions.markVisaDocumentReviewedAction).toBe("function");
    expect(typeof actions.markVisaDocumentProcessedAction).toBe("function");
    expect(typeof actions.requestVisaDocumentReUploadAction).toBe("function");
  });
});

describe("dashboard visa detail actions — auth guards", () => {
  it("updateVisaAction rejects unauthenticated callers (requireRole throws)", async () => {
    requireRoleMock.mockRejectedValueOnce(new Error("Unauthorized"));
    const formData = new FormData();
    formData.set("country", "France");
    formData.set("visaType", "Tourist");
    formData.set("deadline", "2026-12-01");
    formData.set("price", "100");
    formData.set("notes", "x");
    await expect(actions.updateVisaAction("visa-1", formData)).rejects.toThrow(/Unauthorized/);
    expect(updateVisaMock).not.toHaveBeenCalled();
  });

  it("updateVisaAction rejects agents without the visas feature", async () => {
    requireFeatureMock.mockRejectedValueOnce(new Error("Forbidden"));
    const formData = new FormData();
    formData.set("country", "France");
    formData.set("visaType", "Tourist");
    formData.set("deadline", "2026-12-01");
    formData.set("price", "100");
    formData.set("notes", "x");
    await expect(actions.updateVisaAction("visa-1", formData)).rejects.toThrow(/Forbidden/);
    expect(updateVisaMock).not.toHaveBeenCalled();
  });

  it("setVisaClientsAction requires both auth and feature guards before mutation", async () => {
    requireFeatureMock.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(actions.setVisaClientsAction("visa-1", ["c1"])).rejects.toThrow(/Forbidden/);
    expect(setVisaClientsMock).not.toHaveBeenCalled();
  });

  it("transitionVisaStatusAction requires the visas feature before mutation", async () => {
    requireFeatureMock.mockRejectedValueOnce(new Error("Forbidden"));
    await expect(actions.transitionVisaStatusAction("visa-1", "in_progress")).rejects.toThrow(
      /Forbidden/,
    );
    expect(transitionVisaStatusMock).not.toHaveBeenCalled();
  });

  it("document actions reject callers without the visas feature", async () => {
    requireFeatureMock.mockRejectedValue(new Error("Forbidden"));
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    await expect(actions.uploadVisaDocumentAction("visa-1", file)).rejects.toThrow(/Forbidden/);
    await expect(
      actions.requestVisaDocumentAction("visa-1", "c1", "passport"),
    ).rejects.toThrow(/Forbidden/);
    await expect(actions.markVisaDocumentReviewedAction("doc-1")).rejects.toThrow(/Forbidden/);
    await expect(actions.markVisaDocumentProcessedAction("doc-1")).rejects.toThrow(/Forbidden/);
    await expect(
      actions.requestVisaDocumentReUploadAction("doc-1", "redo"),
    ).rejects.toThrow(/Forbidden/);
    expect(uploadVisaDocumentMock).not.toHaveBeenCalled();
    expect(requestVisaDocumentMock).not.toHaveBeenCalled();
    expect(markVisaDocumentReviewedMock).not.toHaveBeenCalled();
    expect(markVisaDocumentProcessedMock).not.toHaveBeenCalled();
    expect(requestVisaDocumentReUploadMock).not.toHaveBeenCalled();
  });
});

describe("dashboard visa detail actions — updateVisaAction happy path", () => {
  it("validates required fields and forwards them to updateVisa", async () => {
    const formData = new FormData();
    formData.set("country", "France");
    formData.set("visaType", "Tourist");
    formData.set("deadline", "2026-12-01");
    formData.set("price", "150");
    formData.set("notes", "Updated notes");
    updateVisaMock.mockResolvedValue({
      id: "visa-1",
      status: "pending",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Updated notes",
      clientId: "",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-02-01T00:00:00.000Z",
    });

    const result = await actions.updateVisaAction("visa-1", formData);

    expect(requireRoleMock).toHaveBeenCalledWith("admin", "agent");
    expect(requireFeatureMock).toHaveBeenCalledWith("visas");
    expect(updateVisaMock).toHaveBeenCalledWith("visa-1", {
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Updated notes",
    });
    expect(result.ok).toBe(true);
    expect(result.visa?.country).toBe("France");
  });

  it("rejects when country is missing", async () => {
    const formData = new FormData();
    formData.set("country", "  ");
    formData.set("visaType", "Tourist");
    formData.set("deadline", "2026-12-01");
    formData.set("price", "100");
    const result = await actions.updateVisaAction("visa-1", formData);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/pa\u00eds/i);
    expect(updateVisaMock).not.toHaveBeenCalled();
  });

  it("rejects when price is not a valid number", async () => {
    const formData = new FormData();
    formData.set("country", "France");
    formData.set("visaType", "Tourist");
    formData.set("deadline", "2026-12-01");
    formData.set("price", "not-a-number");
    const result = await actions.updateVisaAction("visa-1", formData);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/precio/i);
    expect(updateVisaMock).not.toHaveBeenCalled();
  });

  it("never sends status to updateVisa (status is the transition function's job)", async () => {
    updateVisaMock.mockResolvedValue({ id: "visa-1", status: "pending" });
    const formData = new FormData();
    formData.set("country", "France");
    formData.set("visaType", "Tourist");
    formData.set("deadline", "2026-12-01");
    formData.set("price", "100");
    formData.set("status", "completed"); // The action MUST strip this.
    await actions.updateVisaAction("visa-1", formData);
    const [, payload] = updateVisaMock.mock.calls[0];
    expect(payload).not.toHaveProperty("status");
  });
});

describe("dashboard visa detail actions — setVisaClientsAction", () => {
  it("forwards the diff to setVisaClients", async () => {
    setVisaClientsMock.mockResolvedValue(undefined);
    const result = await actions.setVisaClientsAction("visa-1", ["c1", "c2"]);
    expect(result.ok).toBe(true);
    expect(setVisaClientsMock).toHaveBeenCalledWith("visa-1", ["c1", "c2"]);
  });

  it("accepts an empty array (zero clients allowed)", async () => {
    setVisaClientsMock.mockResolvedValue(undefined);
    const result = await actions.setVisaClientsAction("visa-1", []);
    expect(result.ok).toBe(true);
    expect(setVisaClientsMock).toHaveBeenCalledWith("visa-1", []);
  });

  it("returns an error envelope when setVisaClients throws", async () => {
    setVisaClientsMock.mockRejectedValueOnce(new Error("Persistence failed"));
    const result = await actions.setVisaClientsAction("visa-1", ["c1"]);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Persistence failed/);
  });
});

describe("dashboard visa detail actions — transitionVisaStatusAction", () => {
  it("forwards a valid transition to transitionVisaStatus", async () => {
    transitionVisaStatusMock.mockResolvedValue({
      id: "h-1",
      visaId: "visa-1",
      fromStatus: "pending",
      toStatus: "in_progress",
      changedAt: "2026-02-01T00:00:00.000Z",
    });
    const result = await actions.transitionVisaStatusAction("visa-1", "in_progress");
    expect(result.ok).toBe(true);
    expect(transitionVisaStatusMock).toHaveBeenCalledWith("visa-1", "in_progress");
  });

  it("rejects an unknown status string before calling the data layer", async () => {
    const result = await actions.transitionVisaStatusAction("visa-1", "bogus" as never);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid visa status/i);
    expect(transitionVisaStatusMock).not.toHaveBeenCalled();
  });

  it("surfaces the forward-only rejection from the data layer", async () => {
    transitionVisaStatusMock.mockRejectedValueOnce(
      new Error("Illegal visa status transition: completed -> in_progress"),
    );
    const result = await actions.transitionVisaStatusAction("visa-1", "in_progress");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/illegal visa status transition/i);
  });
});

describe("dashboard visa detail actions — document actions", () => {
  it("uploadVisaDocumentAction forwards (visaId, file) to the data layer", async () => {
    const file = new File(["hello"], "doc.pdf", { type: "application/pdf" });
    uploadVisaDocumentMock.mockResolvedValue({
      id: "doc-1",
      visaId: "visa-1",
      status: "uploaded",
    });
    const result = await actions.uploadVisaDocumentAction("visa-1", file);
    expect(result.ok).toBe(true);
    expect(uploadVisaDocumentMock).toHaveBeenCalledWith("visa-1", file);
  });

  it("requestVisaDocumentAction forwards (visaId, clientId, description) and trims", async () => {
    requestVisaDocumentMock.mockResolvedValue({
      id: "doc-2",
      visaId: "visa-1",
      status: "requested",
    });
    const result = await actions.requestVisaDocumentAction("visa-1", "c1", "  passport scan  ");
    expect(result.ok).toBe(true);
    expect(requestVisaDocumentMock).toHaveBeenCalledWith("visa-1", "c1", "passport scan");
  });

  it("requestVisaDocumentAction rejects an empty description before the data layer", async () => {
    const result = await actions.requestVisaDocumentAction("visa-1", "c1", "   ");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/descripci\u00f3n/i);
    expect(requestVisaDocumentMock).not.toHaveBeenCalled();
  });

  it("markVisaDocumentReviewedAction forwards the document id", async () => {
    markVisaDocumentReviewedMock.mockResolvedValue(undefined);
    const result = await actions.markVisaDocumentReviewedAction("doc-1");
    expect(result.ok).toBe(true);
    expect(markVisaDocumentReviewedMock).toHaveBeenCalledWith("doc-1");
  });

  it("markVisaDocumentProcessedAction forwards the document id", async () => {
    markVisaDocumentProcessedMock.mockResolvedValue(undefined);
    const result = await actions.markVisaDocumentProcessedAction("doc-1");
    expect(result.ok).toBe(true);
    expect(markVisaDocumentProcessedMock).toHaveBeenCalledWith("doc-1");
  });

  it("requestVisaDocumentReUploadAction trims the comment and forwards", async () => {
    requestVisaDocumentReUploadMock.mockResolvedValue(undefined);
    const result = await actions.requestVisaDocumentReUploadAction("doc-1", "  please redo  ");
    expect(result.ok).toBe(true);
    expect(requestVisaDocumentReUploadMock).toHaveBeenCalledWith("doc-1", "please redo");
  });

  it("requestVisaDocumentReUploadAction rejects an empty comment before the data layer", async () => {
    const result = await actions.requestVisaDocumentReUploadAction("doc-1", "   ");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/comentario/i);
    expect(requestVisaDocumentReUploadMock).not.toHaveBeenCalled();
  });

  it("returns an error envelope when the data layer throws", async () => {
    markVisaDocumentReviewedMock.mockRejectedValueOnce(
      new Error("Cannot transition visa document 1: current status \"processed\""),
    );
    const result = await actions.markVisaDocumentReviewedAction("doc-1");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/cannot transition/i);
  });
});

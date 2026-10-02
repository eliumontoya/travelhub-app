import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

import { isSupabaseConfigured } from "@/lib/supabase/server";
import {
  mockVisaClients,
  mockVisaDocuments,
  mockVisas,
} from "@/lib/mock-data";

function resetVisaDocumentMocks() {
  mockVisas.length = 0;
  mockVisaClients.length = 0;
  mockVisaDocuments.length = 0;
}

beforeEach(() => {
  resetVisaDocumentMocks();
  vi.mocked(isSupabaseConfigured).mockReturnValue(false);
  vi.clearAllMocks();
});

describe("visa-documents data layer — uploadVisaDocument (mock mode)", () => {
  it("uploads a document to a valid visa with status uploaded and targetClientId null", async () => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const { uploadVisaDocument } = await import("@/lib/data/visa-documents");
    const file = new File(["binary"], "application-form.pdf", {
      type: "application/pdf",
    });

    const doc = await uploadVisaDocument("v1", file);

    expect(doc.status).toBe("uploaded");
    expect(doc.visaId).toBe("v1");
    expect(doc.targetClientId).toBeNull();
    expect(doc.filename).toBe("application-form.pdf");
    expect(doc.mimeType).toBe("application/pdf");
    expect(doc.filePath).toMatch(/^visas\/v1\//);
    expect(doc.uploadedAt).toBeTruthy();
    expect(doc.id).toMatch(/[0-9a-f-]{36}/);
    expect(mockVisaDocuments).toHaveLength(1);
    expect(mockVisaDocuments[0]).toMatchObject({
      visaId: "v1",
      status: "uploaded",
      targetClientId: null,
      filename: "application-form.pdf",
    });
  });

  it("rejects upload to a non-existent visa", async () => {
    const { uploadVisaDocument } = await import("@/lib/data/visa-documents");
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(uploadVisaDocument("missing-visa", file)).rejects.toThrow(
      /visa/i
    );
    expect(mockVisaDocuments).toHaveLength(0);
  });
});

describe("visa-documents data layer — requestVisaDocument (mock mode)", () => {
  beforeEach(() => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
    mockVisaClients.push({
      visaId: "v1",
      clientId: "c1",
      createdAt: "2026-09-30T10:00:00Z",
    });
  });

  it("creates a requested document targeting an assigned client with filePath null", async () => {
    const { requestVisaDocument } = await import("@/lib/data/visa-documents");

    const doc = await requestVisaDocument("v1", "c1", "Passport scan");

    expect(doc.status).toBe("requested");
    expect(doc.visaId).toBe("v1");
    expect(doc.targetClientId).toBe("c1");
    expect(doc.description).toBe("Passport scan");
    expect(doc.filePath).toBeNull();
    expect(doc.uploadedAt).toBeUndefined();
    expect(mockVisaDocuments).toHaveLength(1);
    expect(mockVisaDocuments[0]).toMatchObject({
      visaId: "v1",
      targetClientId: "c1",
      status: "requested",
      description: "Passport scan",
      filePath: null,
    });
  });

  it("rejects request for a non-assigned client", async () => {
    const { requestVisaDocument } = await import("@/lib/data/visa-documents");

    await expect(
      requestVisaDocument("v1", "c-other", "Bank statement")
    ).rejects.toThrow(/c-other|not assigned|not found/i);
    expect(mockVisaDocuments).toHaveLength(0);
  });
});

describe("visa-documents data layer — getVisaDocuments (mock mode)", () => {
  beforeEach(() => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
  });

  it("returns an empty list when a visa has no documents", async () => {
    const { getVisaDocuments } = await import("@/lib/data/visa-documents");

    const docs = await getVisaDocuments("v1");

    expect(docs).toEqual([]);
  });

  it("returns all documents for a visa with their statuses (url null in mock mode)", async () => {
    mockVisaDocuments.push(
      {
        id: "vd1",
        visaId: "v1",
        targetClientId: null,
        description: "Application form",
        filePath: "visas/v1/vd1-form.pdf",
        filename: "form.pdf",
        mimeType: "application/pdf",
        status: "uploaded",
        uploadedAt: "2026-09-30T10:00:00Z",
        createdAt: "2026-09-30T10:00:00Z",
        updatedAt: "2026-09-30T10:00:00Z",
      },
      {
        id: "vd2",
        visaId: "v1",
        targetClientId: "c1",
        description: "Passport scan",
        filePath: null,
        status: "requested",
        createdAt: "2026-09-29T10:00:00Z",
        updatedAt: "2026-09-29T10:00:00Z",
      }
    );

    const { getVisaDocuments } = await import("@/lib/data/visa-documents");

    const docs = await getVisaDocuments("v1");

    expect(docs).toHaveLength(2);
    const ids = docs.map((d) => d.id).sort();
    expect(ids).toEqual(["vd1", "vd2"]);
    expect(docs.every((d) => d.url === null)).toBe(true);
    const statuses = docs.map((d) => d.status).sort();
    expect(statuses).toEqual(["requested", "uploaded"]);
  });
});

describe("visa-documents data layer — uploadVisaDocumentForRequest (mock mode)", () => {
  beforeEach(() => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
  });

  it("traveler upload on a requested document transitions to uploaded and sets filePath", async () => {
    mockVisaDocuments.push({
      id: "vd2",
      visaId: "v1",
      targetClientId: "c1",
      description: "Passport scan",
      filePath: null,
      status: "requested",
      createdAt: "2026-09-29T10:00:00Z",
      updatedAt: "2026-09-29T10:00:00Z",
    });

    const { uploadVisaDocumentForRequest } = await import(
      "@/lib/data/visa-documents"
    );
    const file = new File(["binary"], "passport.pdf", {
      type: "application/pdf",
    });

    const doc = await uploadVisaDocumentForRequest("vd2", "c1", file);

    expect(doc.status).toBe("uploaded");
    expect(doc.filePath).toMatch(/^visas\/v1\//);
    expect(doc.filename).toBe("passport.pdf");
    expect(doc.uploadedAt).toBeTruthy();
    expect(doc.targetClientId).toBe("c1");
  });

  it("re-upload on a re_upload_requested document transitions to uploaded and overwrites the previous file reference", async () => {
    mockVisaDocuments.push({
      id: "vd3",
      visaId: "v1",
      targetClientId: "c1",
      description: "Passport scan",
      filePath: "visas/v1/old-passport.pdf",
      filename: "old-passport.pdf",
      mimeType: "application/pdf",
      status: "re_upload_requested",
      agentComment: "Blurry",
      createdAt: "2026-09-29T10:00:00Z",
      updatedAt: "2026-09-29T11:00:00Z",
    });

    const { uploadVisaDocumentForRequest } = await import(
      "@/lib/data/visa-documents"
    );
    const file = new File(["binary"], "passport-v2.pdf", {
      type: "application/pdf",
    });

    const doc = await uploadVisaDocumentForRequest("vd3", "c1", file);

    expect(doc.status).toBe("uploaded");
    expect(doc.filePath).toMatch(/^visas\/v1\//);
    expect(doc.filePath).not.toBe("visas/v1/old-passport.pdf");
    expect(doc.filename).toBe("passport-v2.pdf");
    // Old filePath should be cleared/overwritten in the row.
    expect(mockVisaDocuments[0].filePath).toMatch(/^visas\/v1\//);
  });

  it("rejects when the caller is not the assigned traveler", async () => {
    mockVisaDocuments.push({
      id: "vd2",
      visaId: "v1",
      targetClientId: "c1",
      description: "Passport scan",
      filePath: null,
      status: "requested",
      createdAt: "2026-09-29T10:00:00Z",
      updatedAt: "2026-09-29T10:00:00Z",
    });

    const { uploadVisaDocumentForRequest } = await import(
      "@/lib/data/visa-documents"
    );
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });

    await expect(
      uploadVisaDocumentForRequest("vd2", "c-other", file)
    ).rejects.toThrow(/c-other|not the assigned/i);
    // Row remains untouched (status stays requested, no filePath).
    const row = mockVisaDocuments[0];
    expect(row.status).toBe("requested");
    expect(row.filePath).toBeNull();
  });
});

describe("visa-documents data layer — agent review operations (mock mode)", () => {
  beforeEach(() => {
    mockVisas.push({
      id: "v1",
      clientId: "c1",
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      status: "pending",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });
  });

  it("markVisaDocumentReviewed transitions uploaded -> reviewed", async () => {
    mockVisaDocuments.push({
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      description: "Application form",
      filePath: "visas/v1/vd1-form.pdf",
      filename: "form.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: "2026-09-30T10:00:00Z",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const { markVisaDocumentReviewed } = await import(
      "@/lib/data/visa-documents"
    );

    await markVisaDocumentReviewed("vd1");

    expect(mockVisaDocuments[0].status).toBe("reviewed");
  });

  it("markVisaDocumentProcessed transitions reviewed -> processed", async () => {
    mockVisaDocuments.push({
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      description: "Application form",
      filePath: "visas/v1/vd1-form.pdf",
      filename: "form.pdf",
      mimeType: "application/pdf",
      status: "reviewed",
      uploadedAt: "2026-09-30T10:00:00Z",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const { markVisaDocumentProcessed } = await import(
      "@/lib/data/visa-documents"
    );

    await markVisaDocumentProcessed("vd1");

    expect(mockVisaDocuments[0].status).toBe("processed");
  });

  it("requestVisaDocumentReUpload transitions uploaded -> re_upload_requested and stores the comment", async () => {
    mockVisaDocuments.push({
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      description: "Application form",
      filePath: "visas/v1/vd1-form.pdf",
      filename: "form.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: "2026-09-30T10:00:00Z",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const { requestVisaDocumentReUpload } = await import(
      "@/lib/data/visa-documents"
    );

    await requestVisaDocumentReUpload("vd1", "File is blurry, please rescan");

    expect(mockVisaDocuments[0].status).toBe("re_upload_requested");
    expect(mockVisaDocuments[0].agentComment).toBe(
      "File is blurry, please rescan"
    );
  });

  it("rejects review transitions from invalid source states", async () => {
    mockVisaDocuments.push({
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      description: "Application form",
      filePath: "visas/v1/vd1-form.pdf",
      filename: "form.pdf",
      mimeType: "application/pdf",
      status: "requested",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const {
      markVisaDocumentReviewed,
      markVisaDocumentProcessed,
      requestVisaDocumentReUpload,
    } = await import("@/lib/data/visa-documents");

    // Reviewed requires `uploaded`.
    await expect(markVisaDocumentReviewed("vd1")).rejects.toThrow(
      /not in \[uploaded\]/
    );
    // Processed requires `reviewed`.
    await expect(markVisaDocumentProcessed("vd1")).rejects.toThrow(
      /not in \[reviewed\]/
    );
    // Re-upload request requires `uploaded`.
    await expect(
      requestVisaDocumentReUpload("vd1", "Please resend")
    ).rejects.toThrow(/not in \[uploaded\]/);

    expect(mockVisaDocuments[0].status).toBe("requested");
  });

  it("requestVisaDocumentReUpload rejects empty comments", async () => {
    mockVisaDocuments.push({
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      description: "Application form",
      filePath: "visas/v1/vd1-form.pdf",
      filename: "form.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: "2026-09-30T10:00:00Z",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const { requestVisaDocumentReUpload } = await import(
      "@/lib/data/visa-documents"
    );

    await expect(requestVisaDocumentReUpload("vd1", "")).rejects.toThrow();
    await expect(
      requestVisaDocumentReUpload("vd1", "   ")
    ).rejects.toThrow();
    expect(mockVisaDocuments[0].status).toBe("uploaded");
  });

  it("assertVisaDocumentMutable throws a generic not-found on cross-visa ownership mismatch", async () => {
    mockVisas.push({
      id: "v2",
      clientId: "c2",
      country: "Japan",
      visaType: "Business",
      deadline: "2026-11-15",
      price: 200,
      status: "pending",
      createdAt: "2026-09-29T10:00:00Z",
      updatedAt: "2026-09-29T10:00:00Z",
    });
    mockVisaDocuments.push({
      id: "vd-other-visa",
      visaId: "v2",
      targetClientId: null,
      description: "Other visa doc",
      filePath: "visas/v2/other.pdf",
      filename: "other.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      createdAt: "2026-09-29T10:00:00Z",
      updatedAt: "2026-09-29T10:00:00Z",
    });

    const { assertVisaDocumentMutable } = await import(
      "@/lib/data/visa-documents"
    );

    // Cross-visa mismatch must map to a generic not-found (no probing).
    await expect(
      assertVisaDocumentMutable("vd-other-visa", "v1")
    ).rejects.toThrow(/not found/i);
    await expect(
      assertVisaDocumentMutable("vd-missing", "v1")
    ).rejects.toThrow(/not found/i);
  });

  it("assertVisaDocumentMutable resolves when the document belongs to the visa", async () => {
    mockVisaDocuments.push({
      id: "vd1",
      visaId: "v1",
      targetClientId: null,
      description: "Application form",
      filePath: "visas/v1/vd1-form.pdf",
      filename: "form.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
      uploadedAt: "2026-09-30T10:00:00Z",
      createdAt: "2026-09-30T10:00:00Z",
      updatedAt: "2026-09-30T10:00:00Z",
    });

    const { assertVisaDocumentMutable } = await import(
      "@/lib/data/visa-documents"
    );

    await expect(
      assertVisaDocumentMutable("vd1", "v1")
    ).resolves.toBeUndefined();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VisaDocument, VisaWithDetails } from "@/types";

// Mocks must be registered before importing the module under test.
vi.mock("@/lib/client-auth", () => ({
  getClientSession: vi.fn(),
}));

const getVisaByIdMock = vi.fn();
const uploadVisaDocumentForRequestMock = vi.fn();
vi.mock("@/lib/data", () => ({
  getVisaById: (...args: unknown[]) => getVisaByIdMock(...args),
  uploadVisaDocumentForRequest: (...args: unknown[]) =>
    uploadVisaDocumentForRequestMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

import { getClientSession } from "@/lib/client-auth";
import * as actions from "../actions";

const baseVisa: VisaWithDetails = {
  id: "visa-1",
  clientId: "client-1",
  country: "France",
  visaType: "Tourist",
  deadline: "2026-12-01",
  price: 100,
  status: "in_progress",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  clients: [
    {
      id: "client-1",
      name: "Maria Lopez",
      email: "maria@example.com",
      phone: "+5491155551234",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  client: {
    id: "client-1",
    name: "Maria Lopez",
    email: "maria@example.com",
    phone: "+5491155551234",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  statusHistory: [],
  documents: [],
};

const baseDoc: VisaDocument = {
  id: "doc-1",
  visaId: "visa-1",
  targetClientId: "client-1",
  description: "Passport scan",
  filePath: null,
  status: "requested",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("client visa documents action surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports only uploadVisaDocumentForRequestAction on the action surface", () => {
    expect(Object.keys(actions).sort()).toEqual(["uploadVisaDocumentForRequestAction"]);
  });

  it("rejects unauthenticated callers before touching the data layer", async () => {
    vi.mocked(getClientSession).mockResolvedValue(null);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    await expect(
      actions.uploadVisaDocumentForRequestAction("visa-1", "doc-1", formData),
    ).rejects.toThrow(/sesi\u00f3n requerida/i);
    expect(uploadVisaDocumentForRequestMock).not.toHaveBeenCalled();
    expect(getVisaByIdMock).not.toHaveBeenCalled();
  });

  it("rejects travelers not assigned to the parent visa", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "client-2",
      expiresAt: Date.now() + 10_000,
    });
    getVisaByIdMock.mockResolvedValue(baseVisa);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    await expect(
      actions.uploadVisaDocumentForRequestAction("visa-1", "doc-1", formData),
    ).rejects.toThrow(/no est\u00e1 asignado/i);
    expect(uploadVisaDocumentForRequestMock).not.toHaveBeenCalled();
  });

  it("rejects when the document is not targeted at the calling traveler", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "client-1",
      expiresAt: Date.now() + 10_000,
    });
    getVisaByIdMock.mockResolvedValue(baseVisa);
    uploadVisaDocumentForRequestMock.mockRejectedValue(
      new Error("Client client-1 is not the assigned traveler for visa document doc-2"),
    );
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    await expect(
      actions.uploadVisaDocumentForRequestAction("visa-1", "doc-2", formData),
    ).rejects.toThrow(/not the assigned traveler/i);
    expect(uploadVisaDocumentForRequestMock).toHaveBeenCalledWith(
      "doc-2",
      "client-1",
      file,
    );
  });

  it("rejects when no file is attached to the form", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "client-1",
      expiresAt: Date.now() + 10_000,
    });
    getVisaByIdMock.mockResolvedValue(baseVisa);
    const formData = new FormData();

    await expect(
      actions.uploadVisaDocumentForRequestAction("visa-1", "doc-1", formData),
    ).rejects.toThrow(/ning\u00fan archivo/i);
    expect(uploadVisaDocumentForRequestMock).not.toHaveBeenCalled();
  });

  it("rejects when the attached file is empty", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "client-1",
      expiresAt: Date.now() + 10_000,
    });
    getVisaByIdMock.mockResolvedValue(baseVisa);
    const file = new File([], "empty.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    await expect(
      actions.uploadVisaDocumentForRequestAction("visa-1", "doc-1", formData),
    ).rejects.toThrow(/ning\u00fan archivo/i);
    expect(uploadVisaDocumentForRequestMock).not.toHaveBeenCalled();
  });

  it("rejects when the visa does not exist", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "client-1",
      expiresAt: Date.now() + 10_000,
    });
    getVisaByIdMock.mockResolvedValue(null);
    const file = new File(["x"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    await expect(
      actions.uploadVisaDocumentForRequestAction("visa-1", "doc-1", formData),
    ).rejects.toThrow(/visa no encontrada/i);
    expect(uploadVisaDocumentForRequestMock).not.toHaveBeenCalled();
  });

  it("forwards (documentId, clientId, file) and revalidates the documents path on success", async () => {
    vi.mocked(getClientSession).mockResolvedValue({
      clientId: "client-1",
      expiresAt: Date.now() + 10_000,
    });
    getVisaByIdMock.mockResolvedValue(baseVisa);
    uploadVisaDocumentForRequestMock.mockResolvedValue({
      ...baseDoc,
      filePath: "visas/visa-1/abc-doc.pdf",
      filename: "doc.pdf",
      mimeType: "application/pdf",
      status: "uploaded",
    });
    const file = new File(["hello"], "doc.pdf", { type: "application/pdf" });
    const formData = new FormData();
    formData.append("file", file);

    const result = await actions.uploadVisaDocumentForRequestAction(
      "visa-1",
      "doc-1",
      formData,
    );

    expect(uploadVisaDocumentForRequestMock).toHaveBeenCalledWith(
      "doc-1",
      "client-1",
      file,
    );
    expect(result).toBeUndefined();
  });
});

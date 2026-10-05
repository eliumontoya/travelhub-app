import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  updateClientMock,
  uploadClientDocumentMock,
  deleteClientDocumentMock,
  getClientDocumentsMock,
  uploadClientCoverImageMock,
  removeClientCoverImageMock,
  setClientTagsMock,
  setClientPinMock,
  getOrCreateTagMock,
  validateClientPinMock,
  revalidatePathMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  updateClientMock: vi.fn(),
  uploadClientDocumentMock: vi.fn(),
  deleteClientDocumentMock: vi.fn(),
  getClientDocumentsMock: vi.fn(),
  uploadClientCoverImageMock: vi.fn(),
  removeClientCoverImageMock: vi.fn(),
  setClientTagsMock: vi.fn(),
  setClientPinMock: vi.fn(),
  getOrCreateTagMock: vi.fn(),
  validateClientPinMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  }),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  updateClient: updateClientMock,
  uploadClientDocument: uploadClientDocumentMock,
  deleteClientDocument: deleteClientDocumentMock,
  getClientDocuments: getClientDocumentsMock,
  uploadClientCoverImage: uploadClientCoverImageMock,
  removeClientCoverImage: removeClientCoverImageMock,
  setClientTags: setClientTagsMock,
  setClientPin: setClientPinMock,
  getOrCreateTag: getOrCreateTagMock,
}));

vi.mock("@/lib/client-pin-validation", () => ({
  validateClientPin: validateClientPinMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireRole } from "@/lib/auth/roles";
import { getClientDocuments } from "@/lib/data";
import {
  updateClientAction,
  uploadClientDocumentAction,
  deleteClientDocumentAction,
  getClientDocumentsAction,
  uploadClientCoverAction,
  removeClientCoverAction,
  setClientTagsAction,
  updateClientPinAction,
} from "../actions";

const guardedCalls: Array<{ name: string; run: () => Promise<unknown> }> = [
  { name: "updateClientAction", run: () => updateClientAction("c1", new FormData()) },
  {
    name: "uploadClientDocumentAction",
    run: () => uploadClientDocumentAction("c1", new FormData()),
  },
  {
    name: "deleteClientDocumentAction",
    run: () => deleteClientDocumentAction("c1", "d1"),
  },
  { name: "getClientDocumentsAction", run: () => getClientDocumentsAction("c1") },
  {
    name: "uploadClientCoverAction",
    run: () => uploadClientCoverAction("c1", new FormData()),
  },
  { name: "removeClientCoverAction", run: () => removeClientCoverAction("c1") },
  { name: "setClientTagsAction", run: () => setClientTagsAction("c1", new FormData()) },
  { name: "updateClientPinAction", run: () => updateClientPinAction("c1", new FormData()) },
];

describe("clients/[id] actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    updateClientMock.mockResolvedValue(undefined);
    getClientDocumentsMock.mockResolvedValue([]);
    setClientTagsMock.mockResolvedValue(undefined);
    setClientPinMock.mockResolvedValue(undefined);
    getOrCreateTagMock.mockResolvedValue({ id: "tag-1" });
    validateClientPinMock.mockReturnValue({ ok: true });
  });

  it.each(guardedCalls)(
    "rejects $name without an allowed role and writes nothing",
    async ({ run }) => {
      vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

      await expect(run()).rejects.toThrow("Unauthorized");

      expect(requireRole).toHaveBeenCalledWith("admin", "agent");
      expect(updateClientMock).not.toHaveBeenCalled();
      expect(setClientPinMock).not.toHaveBeenCalled();
    },
  );

  it("runs updateClientAction for an allowed agent", async () => {
    const formData = new FormData();
    formData.set("name", "Acme");

    await updateClientAction("c1", formData);

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateClientMock).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ name: "Acme" }),
    );
  });

  it("runs getClientDocumentsAction for an allowed agent", async () => {
    getClientDocumentsMock.mockResolvedValue([{ id: "doc-1" }]);

    await expect(getClientDocumentsAction("c1")).resolves.toEqual([{ id: "doc-1" }]);
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(getClientDocuments).toHaveBeenCalledWith("c1");
  });

  it("runs updateClientPinAction for an allowed agent", async () => {
    const formData = new FormData();
    formData.set("pin", "1234");
    formData.set("confirmPin", "1234");

    await expect(updateClientPinAction("c1", formData)).rejects.toThrow(
      "__redirect__:/dashboard/clients/c1?pinSuccess=1",
    );
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(setClientPinMock).toHaveBeenCalledWith("c1", "1234");
  });
});

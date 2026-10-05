import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  createClientMock,
  deleteClientMock,
  getClientByEmailMock,
  getClientByIdMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  createClientMock: vi.fn(),
  deleteClientMock: vi.fn(),
  getClientByEmailMock: vi.fn(),
  getClientByIdMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  createClient: createClientMock,
  deleteClient: deleteClientMock,
  getClientByEmail: getClientByEmailMock,
  getClientById: getClientByIdMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { requireRole } from "@/lib/auth/roles";
import { createClient, deleteClient } from "@/lib/data";
import { createClientAction, deleteClientAction } from "../actions";

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

describe("clients actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    createClientMock.mockResolvedValue({ id: "c1", name: "Acme" });
    getClientByEmailMock.mockResolvedValue(null);
    getClientByIdMock.mockResolvedValue({ id: "c1", name: "Acme" });
    deleteClientMock.mockResolvedValue(undefined);
  });

  it("denies createClientAction for a caller without a valid role and does not write", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(
      createClientAction(formData({ name: "Acme" })),
    ).rejects.toThrow("Unauthorized");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("denies deleteClientAction for a caller without a valid role and does not write", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(
      deleteClientAction("c1", formData({ confirmationName: "Acme" })),
    ).rejects.toThrow("Unauthorized");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(deleteClient).not.toHaveBeenCalled();
  });

  it("runs createClientAction for an allowed agent", async () => {
    const result = await createClientAction(formData({ name: "Acme" }));

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createClient).toHaveBeenCalled();
    expect(result).toEqual({ client: { id: "c1", name: "Acme" } });
  });

  it("runs deleteClientAction for an allowed agent", async () => {
    await deleteClientAction("c1", formData({ confirmationName: "Acme" }));

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(deleteClient).toHaveBeenCalledWith("c1");
  });
});

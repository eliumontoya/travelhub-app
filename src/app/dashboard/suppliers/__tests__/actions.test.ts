import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  createSupplierMock,
  updateSupplierMock,
  softDeleteSupplierMock,
  restoreSupplierMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  createSupplierMock: vi.fn(),
  updateSupplierMock: vi.fn(),
  softDeleteSupplierMock: vi.fn(),
  restoreSupplierMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  createSupplier: createSupplierMock,
  updateSupplier: updateSupplierMock,
  softDeleteSupplier: softDeleteSupplierMock,
  restoreSupplier: restoreSupplierMock,
}));

import { requireRole } from "@/lib/auth/roles";
import { createSupplier, softDeleteSupplier } from "@/lib/data";
import {
  createSupplierAction,
  updateSupplierAction,
  softDeleteSupplierAction,
  forceDeleteSupplierAction,
  restoreSupplierAction,
} from "../actions";

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const guardedCalls: Array<{ name: string; run: () => Promise<unknown> }> = [
  { name: "createSupplierAction", run: () => createSupplierAction(formData({ name: "S" })) },
  {
    name: "updateSupplierAction",
    run: () => updateSupplierAction("s1", formData({ name: "S" })),
  },
  { name: "softDeleteSupplierAction", run: () => softDeleteSupplierAction("s1") },
  { name: "forceDeleteSupplierAction", run: () => forceDeleteSupplierAction("s1") },
  { name: "restoreSupplierAction", run: () => restoreSupplierAction("s1") },
];

describe("suppliers actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    createSupplierMock.mockResolvedValue({ id: "s1", name: "S" });
    updateSupplierMock.mockResolvedValue({ id: "s1", name: "S" });
    softDeleteSupplierMock.mockResolvedValue({ ok: true });
    restoreSupplierMock.mockResolvedValue(undefined);
  });

  it.each(guardedCalls)(
    "rejects $name without an allowed role and writes nothing",
    async ({ run }) => {
      vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

      await expect(run()).rejects.toThrow("Unauthorized");

      expect(requireRole).toHaveBeenCalledWith("admin", "agent");
      expect(createSupplierMock).not.toHaveBeenCalled();
      expect(softDeleteSupplierMock).not.toHaveBeenCalled();
    },
  );

  it("runs createSupplierAction for an allowed agent", async () => {
    const result = await createSupplierAction(formData({ name: "S" }));

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createSupplier).toHaveBeenCalled();
    expect(result).toEqual({ supplier: { id: "s1", name: "S" } });
  });

  it("runs softDeleteSupplierAction for an allowed agent", async () => {
    const result = await softDeleteSupplierAction("s1");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(softDeleteSupplier).toHaveBeenCalledWith("s1");
    expect(result).toEqual({ ok: true });
  });
});

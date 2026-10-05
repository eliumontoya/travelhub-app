import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  createWccKnowledgeEntryMock,
  updateWccKnowledgeEntryMock,
  updateWccKnowledgeStatusMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  createWccKnowledgeEntryMock: vi.fn(),
  updateWccKnowledgeEntryMock: vi.fn(),
  updateWccKnowledgeStatusMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/wcc-knowledge", () => ({
  createWccKnowledgeEntry: createWccKnowledgeEntryMock,
  updateWccKnowledgeEntry: updateWccKnowledgeEntryMock,
  updateWccKnowledgeStatus: updateWccKnowledgeStatusMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { requireRole } from "@/lib/auth/roles";
import {
  createKnowledgeAction,
  updateKnowledgeAction,
  updateKnowledgeStatusAction,
} from "../actions";

const previousState = { ok: false, message: "" } as const;

const guardedCalls: Array<{ name: string; run: () => Promise<unknown> }> = [
  {
    name: "createKnowledgeAction",
    run: () => createKnowledgeAction(previousState, new FormData()),
  },
  {
    name: "updateKnowledgeAction",
    run: () => updateKnowledgeAction("k1", previousState, new FormData()),
  },
  {
    name: "updateKnowledgeStatusAction",
    run: () => updateKnowledgeStatusAction("k1", previousState, new FormData()),
  },
];

describe("wcc knowledge actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    createWccKnowledgeEntryMock.mockResolvedValue({
      ok: true,
      message: "ok",
      entryId: "k1",
    });
    updateWccKnowledgeEntryMock.mockResolvedValue({
      ok: true,
      message: "ok",
      entryId: "k1",
    });
    updateWccKnowledgeStatusMock.mockResolvedValue({
      ok: true,
      message: "ok",
      entryId: "k1",
    });
  });

  it.each(guardedCalls)(
    "rejects $name without an allowed role and writes nothing",
    async ({ run }) => {
      vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

      await expect(run()).rejects.toThrow("Unauthorized");

      expect(requireRole).toHaveBeenCalledWith("admin", "agent");
      expect(createWccKnowledgeEntryMock).not.toHaveBeenCalled();
      expect(updateWccKnowledgeEntryMock).not.toHaveBeenCalled();
      expect(updateWccKnowledgeStatusMock).not.toHaveBeenCalled();
    },
  );

  it("runs createKnowledgeAction for an allowed agent", async () => {
    const result = await createKnowledgeAction(previousState, new FormData());

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createWccKnowledgeEntryMock).toHaveBeenCalled();
    expect(result).toEqual({ ok: true, message: "ok", entryId: "k1" });
  });
});

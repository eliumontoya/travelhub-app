import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  createTravelAgentMock,
  updateTravelAgentMock,
  deleteTravelAgentMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  createTravelAgentMock: vi.fn(),
  updateTravelAgentMock: vi.fn(),
  deleteTravelAgentMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  createTravelAgent: createTravelAgentMock,
  updateTravelAgent: updateTravelAgentMock,
  deleteTravelAgent: deleteTravelAgentMock,
}));

import { requireRole } from "@/lib/auth/roles";
import { createTravelAgent, deleteTravelAgent } from "@/lib/data";
import {
  createTravelAgentAction,
  updateTravelAgentAction,
  deleteTravelAgentAction,
} from "../actions";

function formData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
}

const guardedCalls: Array<{ name: string; run: () => Promise<unknown> }> = [
  {
    name: "createTravelAgentAction",
    run: () => createTravelAgentAction(formData({ name: "A" })),
  },
  {
    name: "updateTravelAgentAction",
    run: () => updateTravelAgentAction("a1", formData({ name: "A" })),
  },
  { name: "deleteTravelAgentAction", run: () => deleteTravelAgentAction("a1") },
];

describe("travel-agents actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    createTravelAgentMock.mockResolvedValue({ id: "a1", name: "A" });
    updateTravelAgentMock.mockResolvedValue({ id: "a1", name: "A" });
    deleteTravelAgentMock.mockResolvedValue(undefined);
  });

  it.each(guardedCalls)(
    "rejects $name without an allowed role and writes nothing",
    async ({ run }) => {
      vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

      await expect(run()).rejects.toThrow("Unauthorized");

      expect(requireRole).toHaveBeenCalledWith("admin", "agent");
      expect(createTravelAgentMock).not.toHaveBeenCalled();
      expect(deleteTravelAgentMock).not.toHaveBeenCalled();
    },
  );

  it("runs createTravelAgentAction for an allowed agent", async () => {
    const result = await createTravelAgentAction(formData({ name: "A" }));

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createTravelAgent).toHaveBeenCalled();
    expect(result).toEqual({ agent: { id: "a1", name: "A" } });
  });

  it("runs deleteTravelAgentAction for an allowed agent", async () => {
    const result = await deleteTravelAgentAction("a1");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(deleteTravelAgent).toHaveBeenCalledWith("a1");
    expect(result).toEqual({ ok: true });
  });
});

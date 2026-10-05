import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireRoleMock, updateTripMock, revalidatePathMock } = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  updateTripMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  updateTrip: updateTripMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { requireRole } from "@/lib/auth/roles";
import { updateTrip } from "@/lib/data";
import { moveTripStatusAction, bulkUpdateTripStatusAction } from "../actions";

describe("dashboard status actions authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    updateTripMock.mockResolvedValue(undefined);
  });

  it("denies moveTripStatusAction without an allowed role and does not write", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(moveTripStatusAction("t1", "published")).rejects.toThrow(
      "Unauthorized",
    );

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateTrip).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("denies bulkUpdateTripStatusAction without an allowed role and does not write", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(
      bulkUpdateTripStatusAction(["t1", "t2"], "archived"),
    ).rejects.toThrow("Unauthorized");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateTrip).not.toHaveBeenCalled();
  });

  it("runs moveTripStatusAction for an allowed agent", async () => {
    await moveTripStatusAction("t1", "published");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateTrip).toHaveBeenCalledWith("t1", { status: "published" });
  });

  it("runs bulkUpdateTripStatusAction for an allowed agent", async () => {
    await bulkUpdateTripStatusAction(["t1", "t2"], "archived");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(updateTrip).toHaveBeenCalledWith("t1", { status: "archived" });
    expect(updateTrip).toHaveBeenCalledWith("t2", { status: "archived" });
  });
});

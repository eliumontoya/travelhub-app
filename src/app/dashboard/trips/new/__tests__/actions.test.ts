import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireRoleMock,
  createClientMock,
  createTripMock,
  createTripFromTemplateMock,
  getOrCreateTagMock,
  redirectMock,
} = vi.hoisted(() => ({
  requireRoleMock: vi.fn(),
  createClientMock: vi.fn(),
  createTripMock: vi.fn(),
  createTripFromTemplateMock: vi.fn(),
  getOrCreateTagMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  }),
}));

vi.mock("@/lib/auth/roles", () => ({
  requireRole: requireRoleMock,
}));

vi.mock("@/lib/data", () => ({
  createClient: createClientMock,
  createTrip: createTripMock,
  createTripFromTemplate: createTripFromTemplateMock,
  getOrCreateTag: getOrCreateTagMock,
}));

vi.mock("@/lib/slugify", () => ({
  slugify: () => "acme",
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { requireRole } from "@/lib/auth/roles";
import { createTrip } from "@/lib/data";
import { createTripAction } from "../actions";

function tripFormData() {
  const formData = new FormData();
  formData.set("title", "Acme trip");
  formData.set("startDate", "2026-01-01");
  formData.set("endDate", "2026-01-05");
  formData.set("currency", "MXN");
  formData.set("travelerCount", "2");
  formData.append("clientIds", "c1");
  return formData;
}

describe("createTripAction authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue("agent");
    createTripMock.mockResolvedValue({ id: "trip-1" });
    createTripFromTemplateMock.mockResolvedValue({ id: "trip-1" });
    getOrCreateTagMock.mockResolvedValue({ id: "tag-1" });
  });

  it("denies a caller without an allowed role and does not create a trip", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Error("Unauthorized"));

    await expect(createTripAction(tripFormData())).rejects.toThrow("Unauthorized");

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createTrip).not.toHaveBeenCalled();
    expect(createTripFromTemplateMock).not.toHaveBeenCalled();
  });

  it("runs for an allowed agent and redirects to the new trip", async () => {
    await expect(createTripAction(tripFormData())).rejects.toThrow(
      "__redirect__:/dashboard/trips/trip-1",
    );

    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(createTrip).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Acme trip", clientIds: ["c1"] }),
    );
  });
});

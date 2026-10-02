import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/roles", () => ({
  requireRole: vi.fn(),
  requireFeature: vi.fn(),
}));

vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  createVisa: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`__redirect__:${url}`);
  }),
}));

import { redirect } from "next/navigation";
import { requireFeature, requireRole } from "@/lib/auth/roles";
import { createVisa } from "@/lib/data";
import { createVisaAction } from "../actions";

const sampleForm = (overrides: Partial<Record<string, string>> = {}) => {
  const data = {
    country: "France",
    visaType: "Tourist",
    deadline: "2026-12-01",
    price: "150",
    notes: "",
    clientIds: "",
    ...overrides,
  };
  const formData = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((v) => formData.append(key, v));
    } else {
      formData.append(key, value);
    }
  });
  return formData;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireRole).mockResolvedValue("agent");
  vi.mocked(requireFeature).mockResolvedValue({} as never);
  vi.mocked(createVisa).mockResolvedValue({
    id: "visa-1",
    clientId: "",
    country: "France",
    visaType: "Tourist",
    deadline: "2026-12-01",
    price: 150,
    status: "pending",
    createdAt: "2026-09-30T10:00:00.000Z",
    updatedAt: "2026-09-30T10:00:00.000Z",
  });
});

describe("createVisaAction", () => {
  it("guards with requireRole('admin', 'agent') + requireFeature('visas')", async () => {
    await expect(createVisaAction(sampleForm())).rejects.toThrow(/__redirect__/);
    expect(requireRole).toHaveBeenCalledWith("admin", "agent");
    expect(requireFeature).toHaveBeenCalledWith("visas");
  });

  it("creates the visa via the data layer and redirects to the detail page", async () => {
    await expect(createVisaAction(sampleForm())).rejects.toThrow(/__redirect__:.*visas\/visa-1/);
    expect(createVisa).toHaveBeenCalledWith({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: undefined,
      clientIds: [],
    });
    expect(redirect).toHaveBeenCalledWith("/dashboard/visas/visa-1");
  });

  it("forwards multiple clientIds and trimmed notes", async () => {
    const fd = sampleForm({ notes: "  Some notes  " });
    fd.append("clientIds", "c1");
    fd.append("clientIds", "c2");
    await expect(createVisaAction(fd)).rejects.toThrow(/__redirect__/);
    expect(createVisa).toHaveBeenCalledWith({
      country: "France",
      visaType: "Tourist",
      deadline: "2026-12-01",
      price: 150,
      notes: "Some notes",
      clientIds: ["c1", "c2"],
    });
  });

  it("rejects when country is missing", async () => {
    await expect(createVisaAction(sampleForm({ country: "" }))).rejects.toThrow(
      /__redirect__:.*error=/,
    );
    expect(createVisa).not.toHaveBeenCalled();
  });

  it("rejects when visaType is missing", async () => {
    await expect(createVisaAction(sampleForm({ visaType: "" }))).rejects.toThrow(
      /__redirect__:.*error=/,
    );
    expect(createVisa).not.toHaveBeenCalled();
  });

  it("rejects when deadline is missing", async () => {
    await expect(createVisaAction(sampleForm({ deadline: "" }))).rejects.toThrow(
      /__redirect__:.*error=/,
    );
    expect(createVisa).not.toHaveBeenCalled();
  });

  it("rejects when price is not a finite number", async () => {
    await expect(createVisaAction(sampleForm({ price: "abc" }))).rejects.toThrow(
      /__redirect__:.*error=/,
    );
    await expect(createVisaAction(sampleForm({ price: "-5" }))).rejects.toThrow(
      /__redirect__:.*error=/,
    );
    expect(createVisa).not.toHaveBeenCalled();
  });
});

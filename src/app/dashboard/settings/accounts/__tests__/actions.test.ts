import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature } from "@/types";

// Mocks for server-only modules. `updateProfileFeaturesAction` reads the
// current account via getCurrentAccount (which itself touches
// `@/lib/supabase/server`) and writes via updateProfileFeatures.
// `revalidatePath` is the server-action post-write hook we want to assert.
const {
  getCurrentAccountMock,
  updateProfileFeaturesMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  getCurrentAccountMock: vi.fn(),
  updateProfileFeaturesMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  getCurrentAccount: getCurrentAccountMock,
}));

vi.mock("@/lib/data/profiles", () => ({
  updateProfileFeatures: updateProfileFeaturesMock,
}));

vi.mock("@/lib/data", () => ({
  updateProfileFeatures: updateProfileFeaturesMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

describe("updateProfileFeaturesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateProfileFeaturesMock.mockImplementation(
      async (id: string, features: Feature[]) => ({
        id,
        role: "agent",
        features,
        travelAgentId: "a1",
      }),
    );
    // Default: an admin session. Individual tests override.
    getCurrentAccountMock.mockResolvedValue({
      id: "admin-1",
      role: "admin",
      features: [],
    });
  });

  it("returns an authorization error for a non-admin account without writing (threat case b)", async () => {
    getCurrentAccountMock.mockResolvedValue({
      id: "agent-1",
      role: "agent",
      features: ["trips", "clients"],
      travelAgentId: "a1",
    });

    const result = await updateProfileFeaturesAction("agent-1", ["trips", "suppliers"]);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(updateProfileFeaturesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns ok and revalidates when an admin writes a profile's features", async () => {
    const result = await updateProfileFeaturesAction("agent-1", [
      "trips",
      "suppliers",
    ]);

    expect(result).toEqual({ ok: true });
    expect(updateProfileFeaturesMock).toHaveBeenCalledWith("agent-1", [
      "trips",
      "suppliers",
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/settings/accounts",
    );
  });

  it("returns a write-error envelope when updateProfileFeatures throws", async () => {
    updateProfileFeaturesMock.mockRejectedValue(new Error("Perfil no encontrado"));

    const result = await updateProfileFeaturesAction("agent-1", ["trips"]);

    expect(result).toEqual({
      ok: false,
      error: "Error al guardar los permisos.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns an authorization error when no account can be resolved", async () => {
    getCurrentAccountMock.mockResolvedValue(null);

    const result = await updateProfileFeaturesAction("agent-1", ["trips"]);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(updateProfileFeaturesMock).not.toHaveBeenCalled();
  });
});

// Imported after mocks so the action resolves the mocked modules.
// Path goes through the same "../actions" the runtime components import.
import { updateProfileFeaturesAction } from "../actions";

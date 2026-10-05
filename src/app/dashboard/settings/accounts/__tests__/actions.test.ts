import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature } from "@/types";

// Mocks for server-only modules. `updateProfileFeaturesAction` authorizes the
// caller via the non-throwing `isCurrentUserAdmin` predicate (so typed errors
// need no try/catch) and writes via updateProfileFeatures.
// `revalidatePath` is the server-action post-write hook we want to assert.
const {
  isCurrentUserAdminMock,
  updateProfileFeaturesMock,
  revalidatePathMock,
} = vi.hoisted(() => ({
  isCurrentUserAdminMock: vi.fn(),
  updateProfileFeaturesMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  isCurrentUserAdmin: isCurrentUserAdminMock,
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
    isCurrentUserAdminMock.mockResolvedValue(true);
  });

  it("returns an authorization error for a non-admin account without writing (threat case b)", async () => {
    isCurrentUserAdminMock.mockResolvedValue(false);

    const result = await updateProfileFeaturesAction("agent-1", ["trips", "suppliers"]);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(isCurrentUserAdminMock).toHaveBeenCalledTimes(1);
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

  it("returns an authorization error when the predicate resolves false without throwing", async () => {
    isCurrentUserAdminMock.mockResolvedValue(false);

    const result = await updateProfileFeaturesAction("agent-1", ["trips"]);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(updateProfileFeaturesMock).not.toHaveBeenCalled();
  });
});

// Imported after mocks so the action resolves the mocked modules.
// Path goes through the same "../actions" the runtime components import.
import { updateProfileFeaturesAction } from "../actions";

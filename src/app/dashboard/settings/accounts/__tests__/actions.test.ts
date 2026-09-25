import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Feature } from "@/types";
import { mockProfiles } from "@/lib/mock-data";

// Mocks for server-only modules. `updateProfileFeaturesAction` reads the
// current account via getCurrentAccount (which itself touches `next/headers`
// and `@/lib/supabase/server`), and writes via updateProfileFeatures.
// `revalidatePath` is the server-action post-write hook we want to assert.
const {
  getCurrentAccountMock,
  resolveMockAccountIdMock,
  updateProfileFeaturesMock,
  revalidatePathMock,
  cookiesMock,
} = vi.hoisted(() => ({
  getCurrentAccountMock: vi.fn(),
  resolveMockAccountIdMock: vi.fn(),
  updateProfileFeaturesMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  cookiesMock: vi.fn(),
}));

vi.mock("@/lib/auth/roles", () => ({
  getCurrentAccount: getCurrentAccountMock,
  resolveMockAccountId: resolveMockAccountIdMock,
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

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(() => false),
  createClient: vi.fn(),
}));

describe("updateProfileFeaturesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock mode and admin account; individual tests override.
    resolveMockAccountIdMock.mockResolvedValue("mock-admin");
    getCurrentAccountMock.mockResolvedValue({
      id: "mock-admin",
      role: "admin",
      features: [],
    });
    updateProfileFeaturesMock.mockImplementation(
      async (id: string, features: Feature[]) => ({
        id,
        role: "agent",
        features,
        travelAgentId: "a1",
      }),
    );
    // Reset mock profiles to a known baseline so the action is reproducible.
    mockProfiles["mock-admin"].features = [];
    mockProfiles["mock-agent"].features = ["trips", "clients"] as Feature[];
  });

  it("returns an authorization error for a non-admin account without writing (threat case b)", async () => {
    getCurrentAccountMock.mockResolvedValue({
      id: "mock-agent",
      role: "agent",
      features: ["trips", "clients"],
      travelAgentId: "a1",
    });

    const result = await updateProfileFeaturesAction("mock-agent", ["trips", "suppliers"]);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(updateProfileFeaturesMock).not.toHaveBeenCalled();
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns ok and revalidates when an admin writes a profile's features", async () => {
    const result = await updateProfileFeaturesAction("mock-agent", [
      "trips",
      "suppliers",
    ]);

    expect(result).toEqual({ ok: true });
    expect(updateProfileFeaturesMock).toHaveBeenCalledWith("mock-agent", [
      "trips",
      "suppliers",
    ]);
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/settings/accounts",
    );
  });

  it("returns a write-error envelope when updateProfileFeatures throws", async () => {
    updateProfileFeaturesMock.mockRejectedValue(new Error("Perfil no encontrado"));

    const result = await updateProfileFeaturesAction("mock-agent", ["trips"]);

    expect(result).toEqual({
      ok: false,
      error: "Error al guardar los permisos.",
    });
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  it("returns an authorization error when no account can be resolved", async () => {
    getCurrentAccountMock.mockResolvedValue(null);

    const result = await updateProfileFeaturesAction("mock-agent", ["trips"]);

    expect(result).toEqual({ ok: false, error: "No autorizado." });
    expect(updateProfileFeaturesMock).not.toHaveBeenCalled();
  });
});

// Imported after mocks so the action resolves the mocked modules.
// Path goes through the same "../actions" the runtime components import.
import { updateProfileFeaturesAction } from "../actions";

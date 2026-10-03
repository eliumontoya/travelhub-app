import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AccountProfile } from "@/types";
import { AVAILABLE_FEATURES } from "@/lib/auth/features";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import { createClient } from "@/lib/supabase/server";
import {
  hasRole,
  canAccessFeature,
  normalizeRole,
  getCurrentAccount,
  getCurrentUserRole,
  getCurrentTravelAgentId,
  requireRole,
  requireFeature,
  requireAdmin,
} from "@/lib/auth/roles";

type ProfileRow = {
  id: string;
  role: string;
  features: unknown;
  travel_agent_id: string | null;
} | null;

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client is mocked and the real Supabase branch of `src/lib/auth/roles.ts`
 * runs. Role resolution is session-based; the removed mock-mode branch is no
 * longer reachable.
 */
function mockSupabase(user: { id: string } | null, row: ProfileRow) {
  const single = vi.fn().mockResolvedValue({
    data: row,
    error: row ? null : { message: "not found" },
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }) },
    from,
  };
  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>
  );
  return { from, select, eq, single, client };
}

function mockAccount(account: AccountProfile | null) {
  if (!account) return mockSupabase(null, null);
  return mockSupabase(
    { id: account.id },
    {
      id: account.id,
      role: account.role,
      features: account.features,
      travel_agent_id: account.travelAgentId ?? null,
    }
  );
}

const ADMIN: AccountProfile = { id: "admin-1", role: "admin", features: [] };
const AGENT: AccountProfile = {
  id: "agent-1",
  role: "agent",
  features: ["trips", "clients"],
  travelAgentId: "a1",
};

describe("role helpers", () => {
  describe("normalizeRole", () => {
    it("returns admin for the admin string", () => {
      expect(normalizeRole("admin")).toBe("admin");
    });

    it("returns agent for the agent string", () => {
      expect(normalizeRole("agent")).toBe("agent");
    });

    it("returns null for unknown or missing roles", () => {
      expect(normalizeRole("superuser")).toBeNull();
      expect(normalizeRole(null)).toBeNull();
      expect(normalizeRole(undefined)).toBeNull();
    });
  });

  describe("hasRole", () => {
    it("returns true when the role is in the allowed list", () => {
      expect(hasRole("admin", ["admin", "agent"])).toBe(true);
      expect(hasRole("agent", ["agent"])).toBe(true);
    });

    it("returns false for a missing or disallowed role", () => {
      expect(hasRole(null, ["admin", "agent"])).toBe(false);
      expect(hasRole("agent", ["admin"])).toBe(false);
    });
  });

  describe("canAccessFeature", () => {
    it("lets admins access any feature regardless of assignment", () => {
      const admin: AccountProfile = { id: "u1", role: "admin", features: [] };
      expect(canAccessFeature(admin, "settings")).toBe(true);
    });

    it("lets admins access every catalog feature even with empty features[]", () => {
      const admin: AccountProfile = { id: "u1", role: "admin", features: [] };
      for (const feature of AVAILABLE_FEATURES) {
        expect(canAccessFeature(admin, feature)).toBe(true);
      }
    });

    it("lets agents access only assigned features", () => {
      const agent: AccountProfile = { id: "u2", role: "agent", features: ["trips"] };
      expect(canAccessFeature(agent, "trips")).toBe(true);
      expect(canAccessFeature(agent, "settings")).toBe(false);
    });

    it("evaluates the full catalog matrix for an agent with two features", () => {
      const agent: AccountProfile = {
        id: "u3",
        role: "agent",
        features: ["trips", "clients"],
      };
      for (const feature of AVAILABLE_FEATURES) {
        const expected = feature === "trips" || feature === "clients";
        expect(canAccessFeature(agent, feature)).toBe(expected);
      }
    });

    it("returns false for every catalog feature when the agent has no features assigned", () => {
      const agent: AccountProfile = { id: "u4", role: "agent", features: [] };
      for (const feature of AVAILABLE_FEATURES) {
        expect(canAccessFeature(agent, feature)).toBe(false);
      }
    });

    it("returns false when no profile is provided", () => {
      expect(canAccessFeature(null, "trips")).toBe(false);
    });
  });
});

describe("getCurrentAccount (Supabase session)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the profiles table for the authenticated user", async () => {
    const { from, select, eq } = mockAccount(AGENT);

    const account = await getCurrentAccount();

    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("id, role, features, travel_agent_id");
    expect(eq).toHaveBeenCalledWith("id", "agent-1");
    expect(account).toEqual(AGENT);
  });

  it("returns null when the user has no session", async () => {
    mockSupabase(null, null);

    expect(await getCurrentAccount()).toBeNull();
    expect(await getCurrentUserRole()).toBeNull();
    expect(await getCurrentTravelAgentId()).toBeNull();
  });

  it("returns null when the profile row is missing", async () => {
    mockSupabase({ id: "auth-user-1" }, null);

    expect(await getCurrentAccount()).toBeNull();
  });

  it("returns null when the stored role is not recognized", async () => {
    mockSupabase(
      { id: "auth-user-1" },
      { id: "auth-user-1", role: "superuser", features: [], travel_agent_id: null }
    );

    expect(await getCurrentUserRole()).toBeNull();
  });

  it("resolves the linked travel agent id", async () => {
    mockAccount(AGENT);
    expect(await getCurrentTravelAgentId()).toBe("a1");
  });

  it("returns null for an account without a linked travel agent", async () => {
    mockAccount(ADMIN);
    expect(await getCurrentTravelAgentId()).toBeNull();
  });

  it("drops unknown feature strings returned from the profiles row", async () => {
    mockSupabase(
      { id: "auth-user-1" },
      {
        id: "auth-user-1",
        role: "agent",
        features: ["trips", "bogus", "clients"],
        travel_agent_id: null,
      }
    );

    const account = await getCurrentAccount();
    expect(account?.features).toEqual(["trips", "clients"]);
    expect(account?.features).not.toContain("bogus");
  });
});

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the role when it is allowed", async () => {
    mockAccount(ADMIN);
    expect(await requireRole("admin")).toBe("admin");
    expect(await requireRole("admin", "agent")).toBe("admin");
  });

  it("throws Unauthorized when the role is not allowed", async () => {
    mockAccount(AGENT);
    await expect(requireRole("admin")).rejects.toThrow("Unauthorized");
  });

  it("throws Unauthorized when there is no session", async () => {
    mockSupabase(null, null);
    await expect(requireRole("admin")).rejects.toThrow("Unauthorized");
  });
});

describe("feature-level guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockClear();
    redirectMock.mockImplementation((path: string) => {
      throw new Error(`NEXT_REDIRECT:${path}`);
    });
  });

  describe("requireFeature", () => {
    it("returns the admin account for any feature regardless of assignment", async () => {
      mockAccount(ADMIN);
      const account = await requireFeature("settings");
      expect(account.role).toBe("admin");
      expect(account.id).toBe("admin-1");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("returns the agent account when the feature is assigned", async () => {
      mockAccount(AGENT);
      const account = await requireFeature("trips");
      expect(account.role).toBe("agent");
      expect(account.id).toBe("agent-1");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("redirects an agent away from a feature they do not have", async () => {
      mockAccount(AGENT);
      await expect(requireFeature("settings")).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects to /dashboard when no account can be resolved", async () => {
      mockSupabase(null, null);
      await expect(requireFeature("trips")).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });

    it("evaluates the full catalog: the agent has access to exactly [trips, clients]", async () => {
      for (const feature of AVAILABLE_FEATURES) {
        redirectMock.mockClear();
        mockAccount(AGENT);
        if (feature === "trips" || feature === "clients") {
          const account = await requireFeature(feature);
          expect(account.id).toBe("agent-1");
          expect(redirectMock).not.toHaveBeenCalled();
        } else {
          await expect(requireFeature(feature)).rejects.toThrow("NEXT_REDIRECT:/dashboard");
          expect(redirectMock).toHaveBeenCalledWith("/dashboard");
        }
      }
    });
  });

  describe("requireAdmin", () => {
    it("returns the admin account", async () => {
      mockAccount(ADMIN);
      const account = await requireAdmin();
      expect(account.role).toBe("admin");
      expect(redirectMock).not.toHaveBeenCalled();
    });

    it("redirects an agent to /dashboard", async () => {
      mockAccount(AGENT);
      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });

    it("redirects when no account can be resolved", async () => {
      mockSupabase(null, null);
      await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
      expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AccountProfile, Feature } from "@/types";
import { AVAILABLE_FEATURES } from "@/lib/auth/features";
import { mockProfiles, currentMockAccountId, setCurrentMockAccountId } from "@/lib/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
}));

import { isSupabaseConfigured, createClient } from "@/lib/supabase/server";
import {
  hasRole,
  canAccessFeature,
  normalizeRole,
  getCurrentAccount,
  getCurrentUserRole,
  getCurrentTravelAgentId,
  requireRole,
} from "@/lib/auth/roles";

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

  describe("mock profiles", () => {
    it("exposes a default admin account with full access", () => {
      expect(currentMockAccountId).toBe("mock-admin");
      expect(mockProfiles["mock-admin"].role).toBe("admin");
      expect(canAccessFeature(mockProfiles["mock-admin"], "settings")).toBe(true);
    });

    it("exposes an agent account with limited features", () => {
      expect(mockProfiles["mock-agent"].role).toBe("agent");
      expect(canAccessFeature(mockProfiles["mock-agent"], "trips")).toBe(true);
      expect(canAccessFeature(mockProfiles["mock-agent"], "settings")).toBe(false);
    });
  });
});

describe("dual-mode role facade", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    setCurrentMockAccountId("mock-admin");
  });

  describe("mock mode", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    });

    it("returns the default mock admin account", async () => {
      const account = await getCurrentAccount();
      expect(account).toEqual(mockProfiles["mock-admin"]);
      expect(account?.role).toBe("admin");
    });

    it("returns the role of the current mock account", async () => {
      expect(await getCurrentUserRole()).toBe("admin");
    });

    it("resolves the linked travel agent id for the mock agent", async () => {
      setCurrentMockAccountId("mock-agent");
      expect(await getCurrentTravelAgentId()).toBe("a1");
      setCurrentMockAccountId("mock-admin");
    });

    it("returns null for an unlinked mock account", async () => {
      setCurrentMockAccountId("mock-admin");
      expect(await getCurrentTravelAgentId()).toBeNull();
    });
  });

  describe("supabase mode", () => {
    const mockUser = { id: "auth-user-1" };
    const mockSupabase = {
      auth: { getUser: vi.fn() },
      from: vi.fn(),
    };

    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      vi.mocked(createClient).mockResolvedValue(mockSupabase as unknown as Awaited<ReturnType<typeof createClient>>);
    });

    it("queries the profiles table for the authenticated user", async () => {
      const profileRow = {
        id: "auth-user-1",
        role: "agent",
        features: ["trips"],
        travel_agent_id: "a1",
      };
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      const single = vi.fn().mockResolvedValue({ data: profileRow, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockSupabase.from.mockReturnValue({ select });

      const account = await getCurrentAccount();

      expect(mockSupabase.from).toHaveBeenCalledWith("profiles");
      expect(select).toHaveBeenCalledWith("id, role, features, travel_agent_id");
      expect(eq).toHaveBeenCalledWith("id", mockUser.id);
      expect(account).toEqual({
        id: "auth-user-1",
        role: "agent",
        features: ["trips"],
        travelAgentId: "a1",
      });
    });

    it("returns null when the user has no session", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

      expect(await getCurrentAccount()).toBeNull();
      expect(await getCurrentUserRole()).toBeNull();
      expect(await getCurrentTravelAgentId()).toBeNull();
    });

    it("returns null when the profile row is missing", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockSupabase.from.mockReturnValue({ select });

      expect(await getCurrentAccount()).toBeNull();
    });

    it("returns null when the stored role is not recognized", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: mockUser }, error: null });
      const single = vi.fn().mockResolvedValue({
        data: { id: "auth-user-1", role: "superuser", features: [], travel_agent_id: null },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      mockSupabase.from.mockReturnValue({ select });

      expect(await getCurrentUserRole()).toBeNull();
    });
  });

  describe("requireRole", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    });

    it("returns the role when it is allowed", async () => {
      expect(await requireRole("admin")).toBe("admin");
      expect(await requireRole("admin", "agent")).toBe("admin");
    });

    it("throws when the role is not allowed", async () => {
      setCurrentMockAccountId("mock-agent");
      await expect(requireRole("admin")).rejects.toThrow("Unauthorized");
      setCurrentMockAccountId("mock-admin");
    });
  });
});

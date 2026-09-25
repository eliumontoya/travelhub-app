import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Feature } from "@/types";
import { mockProfiles, setCurrentMockAccountId } from "@/lib/mock-data";
import { filterFeatures } from "@/lib/auth/features";

const { isSupabaseConfigured, createClient } = vi.hoisted(() => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured,
  createClient,
}));

import { listProfiles, updateProfileFeatures, rowToProfile } from "@/lib/data/profiles";

describe("profiles data layer", () => {
  describe("rowToProfile", () => {
    it("maps a profiles row to AccountProfile", () => {
      const row = {
        id: "user-1",
        role: "agent",
        features: ["trips", "clients"],
        travel_agent_id: "a1",
      };
      expect(rowToProfile(row)).toEqual({
        id: "user-1",
        role: "agent",
        features: ["trips", "clients"],
        travelAgentId: "a1",
      });
    });

    it("drops unknown feature strings defensively", () => {
      const row = {
        id: "user-2",
        role: "agent",
        features: ["trips", "bogus", "clients"],
        travel_agent_id: null,
      };
      expect(rowToProfile(row).features).toEqual(["trips", "clients"]);
    });

    it("treats a missing travel_agent_id as undefined", () => {
      const row = {
        id: "user-3",
        role: "admin",
        features: [],
        travel_agent_id: null,
      };
      expect(rowToProfile(row).travelAgentId).toBeUndefined();
    });
  });

  describe("listProfiles (mock mode)", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      // Reset the mock profiles to their known baseline before each test.
      mockProfiles["mock-admin"].features = [];
      mockProfiles["mock-agent"].features = ["trips", "clients"] as Feature[];
    });

    it("returns every value from mockProfiles", async () => {
      const profiles = await listProfiles();
      const ids = profiles.map((p) => p.id).sort();
      expect(ids).toEqual(["mock-admin", "mock-agent"]);
      expect(profiles.length).toBe(Object.keys(mockProfiles).length);
    });

    it("returns profiles with the expected shape", async () => {
      const profiles = await listProfiles();
      const admin = profiles.find((p) => p.id === "mock-admin");
      const agent = profiles.find((p) => p.id === "mock-agent");
      expect(admin).toEqual({
        id: "mock-admin",
        role: "admin",
        features: [],
      });
      expect(agent).toEqual({
        id: "mock-agent",
        role: "agent",
        features: ["trips", "clients"],
        travelAgentId: "a1",
      });
    });
  });

  describe("listProfiles (supabase mode)", () => {
    const mockUser = { id: "auth-user-1" };

    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    });

    it("queries the profiles table ordered by created_at", async () => {
      const rows = [
        { id: "u1", role: "admin", features: [], travel_agent_id: null },
        { id: "u2", role: "agent", features: ["trips"], travel_agent_id: "a1" },
      ];
      const order = vi.fn().mockResolvedValue({ data: rows, error: null });
      const select = vi.fn().mockReturnValue({ order });
      const from = vi.fn().mockReturnValue({ select });
      vi.mocked(createClient).mockResolvedValue({
        from,
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const profiles = await listProfiles();

      expect(from).toHaveBeenCalledWith("profiles");
      expect(select).toHaveBeenCalledWith("id, role, features, travel_agent_id");
      expect(order).toHaveBeenCalledWith("created_at");
      expect(profiles).toEqual([
        { id: "u1", role: "admin", features: [], travelAgentId: undefined },
        { id: "u2", role: "agent", features: ["trips"], travelAgentId: "a1" },
      ]);
    });

    it("throws when supabase returns an error", async () => {
      const order = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
      const select = vi.fn().mockReturnValue({ order });
      const from = vi.fn().mockReturnValue({ select });
      vi.mocked(createClient).mockResolvedValue({
        from,
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      await expect(listProfiles()).rejects.toBeDefined();
    });

    it("returns an empty array when supabase returns no data", async () => {
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const select = vi.fn().mockReturnValue({ order });
      const from = vi.fn().mockReturnValue({ select });
      vi.mocked(createClient).mockResolvedValue({
        from,
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      expect(await listProfiles()).toEqual([]);
    });
  });

  describe("updateProfileFeatures (mock mode)", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(false);
      mockProfiles["mock-agent"].features = ["trips", "clients"] as Feature[];
    });

    afterEach(() => {
      mockProfiles["mock-agent"].features = ["trips", "clients"] as Feature[];
      setCurrentMockAccountId("mock-admin");
    });

    it("mutates mockProfiles[id].features in place", async () => {
      const before = [...mockProfiles["mock-agent"].features];
      const updated = await updateProfileFeatures("mock-agent", ["trips"]);

      expect(updated.features).toEqual(["trips"]);
      expect(mockProfiles["mock-agent"].features).toEqual(["trips"]);
      expect(mockProfiles["mock-agent"].features).not.toEqual(before);
    });

    it("a subsequent listProfiles reflects the change", async () => {
      await updateProfileFeatures("mock-agent", ["suppliers", "settings"]);
      const profiles = await listProfiles();
      const agent = profiles.find((p) => p.id === "mock-agent");
      expect(agent?.features).toEqual(["suppliers", "settings"]);
    });

    it("clears all features when the input is empty", async () => {
      const updated = await updateProfileFeatures("mock-agent", []);
      expect(updated.features).toEqual([]);
      expect(mockProfiles["mock-agent"].features).toEqual([]);
    });

    it("throws when the profile id is unknown", async () => {
      await expect(updateProfileFeatures("does-not-exist", ["trips"])).rejects.toThrow(
        /Perfil no encontrado/,
      );
    });

    it("does NOT persist unknown feature strings (threat case c)", async () => {
      const updated = await updateProfileFeatures("mock-agent", [
        "trips",
        "bogus",
        "another-bad",
      ] as Feature[]);

      expect(updated.features).toEqual(["trips"]);
      expect(mockProfiles["mock-agent"].features).toEqual(["trips"]);
      expect(filterFeatures(["trips", "bogus", "another-bad"])).toEqual(["trips"]);
    });
  });

  describe("updateProfileFeatures (supabase mode)", () => {
    beforeEach(() => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
    });

    it("calls .update with sanitized features and updated_at, filtered by id, then .select().single()", async () => {
      const updatedRow = {
        id: "u2",
        role: "agent",
        features: ["trips", "clients"],
        travel_agent_id: "a1",
      };
      const single = vi.fn().mockResolvedValue({ data: updatedRow, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ update });
      vi.mocked(createClient).mockResolvedValue({
        from,
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const result = await updateProfileFeatures("u2", ["trips", "clients"]);

      expect(from).toHaveBeenCalledWith("profiles");
      expect(update).toHaveBeenCalledTimes(1);
      const patch = update.mock.calls[0][0] as Record<string, unknown>;
      expect(patch.features).toEqual(["trips", "clients"]);
      expect(typeof patch.updated_at).toBe("string");
      expect(eq).toHaveBeenCalledWith("id", "u2");
      expect(select).toHaveBeenCalledWith("id, role, features, travel_agent_id");
      expect(single).toHaveBeenCalled();
      expect(result).toEqual({
        id: "u2",
        role: "agent",
        features: ["trips", "clients"],
        travelAgentId: "a1",
      });
    });

    it("strips unknown feature strings before sending the update", async () => {
      const single = vi.fn().mockResolvedValue({
        data: { id: "u2", role: "agent", features: ["trips"], travel_agent_id: null },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ update });
      vi.mocked(createClient).mockResolvedValue({
        from,
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      await updateProfileFeatures("u2", ["trips", "bogus"] as Feature[]);

      expect(update.mock.calls[0][0]).toMatchObject({ features: ["trips"] });
    });

    it("throws when supabase returns an error", async () => {
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      const from = vi.fn().mockReturnValue({ update });
      vi.mocked(createClient).mockResolvedValue({
        from,
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      await expect(updateProfileFeatures("u2", ["trips"])).rejects.toBeDefined();
    });
  });
});

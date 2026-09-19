import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockClientPinHashes, mockTripInternalNotes, mockTrips, mockTripClients } from "@/lib/mock-data";
import { getClientHomeTrips, getClientProfileForHome } from "@/lib/data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: vi.fn(),
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

import { isSupabaseConfigured } from "@/lib/supabase/server";

describe("client home data (mock mode)", () => {
  beforeEach(() => {
    vi.mocked(isSupabaseConfigured).mockReturnValue(false);
    mockClientPinHashes.clear();
    mockTripInternalNotes["t1"] = "Notas internas que el cliente no debe ver";
  });

  describe("getClientProfileForHome", () => {
    it("returns only whitelisted profile fields for the client", async () => {
      const profile = await getClientProfileForHome("c1");

      expect(profile).not.toBeNull();
      expect(profile?.name).toBe("Ana y Roberto Pérez");
      expect(profile?.email).toBe("ana.perez@example.com");
      expect(profile?.phone).toBe("+52 55 1234 5678");
      expect(profile?.whatsapp).toBe("+52 55 1234 5678");
      expect(profile?.birthDate).toBe("1990-08-01");
      expect(profile?.notes).toBe("Luna de miel, prefieren hoteles boutique.");
      expect(profile?.referralSource).toBeUndefined();
      expect(profile?.coverImageUrl).toBe(
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=70"
      );
    });

    it("omits agent-only fields from the profile", async () => {
      const profile = await getClientProfileForHome("c1");

      expect(profile).not.toHaveProperty("id");
      expect(profile).not.toHaveProperty("slug");
      expect(profile).not.toHaveProperty("createdAt");
      expect(profile).not.toHaveProperty("updatedAt");
    });

    it("returns null when the client does not exist", async () => {
      const profile = await getClientProfileForHome("nonexistent");

      expect(profile).toBeNull();
    });
  });

  describe("getClientHomeTrips", () => {
    it("returns draft and published trips linked to the client", async () => {
      // Arrange: link client c1 to the draft trip t2 so the result is non-trivial.
      mockTripClients.push({ tripId: "t2", clientId: "c1", createdAt: "2026-07-05T09:00:00Z" });

      const trips = await getClientHomeTrips("c1");

      expect(trips).toHaveLength(2);
      expect(trips.map((t) => t.status)).toEqual(expect.arrayContaining(["published", "draft"]));
    });

    it("excludes archived trips", async () => {
      mockTrips.push({
        id: "t-archived",
        clientId: "c1",
        title: "Viaje archivado",
        slug: "viaje-archivado",
        startDate: "2026-10-01",
        endDate: "2026-10-05",
        travelerCount: 2,
        status: "archived",
        currency: "USD",
        isTemplate: false,
        showCostsToClient: false,
        createdAt: "2026-07-06T09:00:00Z",
        updatedAt: "2026-07-06T09:00:00Z",
      });
      mockTripClients.push({ tripId: "t-archived", clientId: "c1", createdAt: "2026-07-06T09:00:00Z" });

      const trips = await getClientHomeTrips("c1");

      expect(trips.some((t) => t.id === "t-archived")).toBe(false);
    });

    it("keeps salePrice and assigned agent visible to the client", async () => {
      mockTrips.push({
        id: "t-sale",
        clientId: "c1",
        title: "Viaje con precio",
        slug: "viaje-precio",
        startDate: "2026-11-01",
        endDate: "2026-11-05",
        travelerCount: 2,
        status: "published",
        currency: "USD",
        isTemplate: false,
        showCostsToClient: false,
        salePrice: 8500,
        assignedAgentId: "a2",
        createdAt: "2026-07-08T09:00:00Z",
        updatedAt: "2026-07-08T09:00:00Z",
      });
      mockTripClients.push({ tripId: "t-sale", clientId: "c1", createdAt: "2026-07-08T09:00:00Z" });

      const trips = await getClientHomeTrips("c1");
      const published = trips.find((t) => t.id === "t-sale");

      expect(published).toBeDefined();
      expect(published?.salePrice).toBe(8500);
      expect(published?.assignedAgentId).toBe("a2");
      expect(published?.assignedAgentName).toBe("María González");
    });

    it("never exposes commissionRate or internalNotes", async () => {
      mockTrips.push({
        id: "t-agent-fields",
        clientId: "c1",
        title: "Viaje con comisión",
        slug: "viaje-comision",
        startDate: "2026-11-01",
        endDate: "2026-11-05",
        travelerCount: 2,
        status: "published",
        currency: "USD",
        isTemplate: false,
        showCostsToClient: false,
        salePrice: 5000,
        commissionRate: 0.15,
        assignedAgentId: "a1",
        createdAt: "2026-07-07T09:00:00Z",
        updatedAt: "2026-07-07T09:00:00Z",
      });
      mockTripClients.push({ tripId: "t-agent-fields", clientId: "c1", createdAt: "2026-07-07T09:00:00Z" });
      mockTripInternalNotes["t-agent-fields"] = "Notas internas";

      const trips = await getClientHomeTrips("c1");
      const trip = trips.find((t) => t.id === "t-agent-fields");

      expect(trip).toBeDefined();
      expect(trip?.salePrice).toBe(5000);
      expect("commissionRate" in trip!).toBe(false);
      expect("internalNotes" in trip!).toBe(false);
    });

    it("returns an empty array when the client has no trips", async () => {
      const trips = await getClientHomeTrips("c3");

      expect(trips).toEqual([]);
    });
  });

  describe("graceful degradation", () => {
    it("returns null and empty array when Supabase is configured but service role key is missing", async () => {
      vi.mocked(isSupabaseConfigured).mockReturnValue(true);
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      const profile = await getClientProfileForHome("c1");
      const trips = await getClientHomeTrips("c1");

      expect(profile).toBeNull();
      expect(trips).toEqual([]);

      process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
    });
  });
});

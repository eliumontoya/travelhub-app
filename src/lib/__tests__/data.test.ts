import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  getTrips,
  getTripWithDetails,
  getTripsByClientId,
  getClientTripSummary,
  getTags,
  getOrCreateTag,
} from "@/lib/data";

describe("data layer (mock mode)", () => {
  describe("getClients", () => {
    it("retorna clientes paginados", async () => {
      const result = await getClients({ page: 1, pageSize: 10 });
      expect(result.items.length).toBeLessThanOrEqual(10);
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it("respeta la paginación", async () => {
      const page1 = await getClients({ page: 1, pageSize: 1 });
      const page2 = await getClients({ page: 2, pageSize: 1 });
      expect(page1.items).toHaveLength(1);
      expect(page2.items).toHaveLength(1);
      expect(page1.items[0].id).not.toBe(page2.items[0].id);
    });
  });

  describe("getClientById", () => {
    it("retorna un cliente existente", async () => {
      const clients = await getClients({ pageSize: 1 });
      const client = await getClientById(clients.items[0].id);
      expect(client).not.toBeNull();
      expect(client!.name).toBeTruthy();
    });

    it("retorna null para id inexistente", async () => {
      const client = await getClientById("nonexistent-id");
      expect(client).toBeNull();
    });
  });

  describe("createClient + updateClient", () => {
    it("crea un cliente y lo puede encontrar por id", async () => {
      const created = await createClient({
        name: "Test Client",
        email: "test@example.com",
      });
      expect(created.name).toBe("Test Client");
      expect(created.email).toBe("test@example.com");
      expect(created.id).toBeTruthy();

      const found = await getClientById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe("Test Client");
    });

    it("actualiza un cliente existente", async () => {
      const created = await createClient({ name: "Original Name" });
      const updated = await updateClient(created.id, { name: "Updated Name" });
      expect(updated.name).toBe("Updated Name");

      const found = await getClientById(created.id);
      expect(found!.name).toBe("Updated Name");
    });
  });

  describe("getTrips", () => {
    it("retorna viajes no-template", async () => {
      const result = await getTrips({ pageSize: 10 });
      expect(result.items.length).toBeGreaterThan(0);
      for (const trip of result.items) {
        expect(trip.isTemplate).toBe(false);
      }
    });
  });

  describe("getTripWithDetails", () => {
    it("retorna un viaje con sus días", async () => {
      const trips = await getTrips({ pageSize: 1 });
      const trip = await getTripWithDetails(trips.items[0].slug);
      expect(trip).not.toBeNull();
      expect(trip!.days).toBeDefined();
      expect(Array.isArray(trip!.days)).toBe(true);
    });

    it("retorna null para slug inexistente", async () => {
      const trip = await getTripWithDetails("nonexistent-slug");
      expect(trip).toBeNull();
    });
  });

  describe("getTripsByClientId", () => {
    it("retorna viajes de un cliente existente", async () => {
      const clients = await getClients({ pageSize: 1 });
      const trips = await getTripsByClientId(clients.items[0].id);
      expect(Array.isArray(trips)).toBe(true);
    });
  });

  describe("getClientTripSummary", () => {
    it("retorna un resumen válido", async () => {
      const clients = await getClients({ pageSize: 1 });
      const summary = await getClientTripSummary(clients.items[0].id);
      expect(summary.totalTrips).toBeGreaterThanOrEqual(0);
      expect(summary.publishedCount + summary.draftCount + summary.archivedCount).toBe(
        summary.totalTrips
      );
    });
  });

  describe("getTags", () => {
    it("retorna un array de tags", async () => {
      const tags = await getTags();
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe("getOrCreateTag", () => {
    it("crea un tag nuevo", async () => {
      const tag = await getOrCreateTag("Tag Test Único");
      expect(tag.name).toBe("Tag Test Único");
      expect(tag.id).toBeTruthy();
    });

    it("retorna el mismo tag si ya existe (case-insensitive)", async () => {
      const tag1 = await getOrCreateTag("Duplicate Tag");
      const tag2 = await getOrCreateTag("duplicate tag");
      expect(tag1.id).toBe(tag2.id);
    });
  });
});

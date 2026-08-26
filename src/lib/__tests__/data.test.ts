import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import {
  getClients,
  getClientById,
  createClient,
  createItem,
  createPackingItem,
  createTrip,
  createTripDay,
  deleteTrip,
  updateClient,
  deleteClient,
  getTripById,
  getTrips,
  getTripsWithClients,
  getTripWithDetails,
  getTripsByClientId,
  getClientTripSummary,
  getTags,
  getOrCreateTag,
  setTripTags,
  updateTripInternalNotes,
  createSupplier,
  updateSupplier,
  getSupplierById,
} from "@/lib/data";
import {
  mockItems,
  mockPackingItems,
  mockTripClients,
  mockTripDays,
  mockTripFeedback,
  mockTripInternalNotes,
  mockTripPhotos,
  mockTrips,
  mockTripStatusHistory,
  mockTripTags,
} from "@/lib/mock-data";

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


  describe("deleteClient", () => {
    it("removes a client from mock storage", async () => {
      const client = await createClient({ name: "Delete Me" });

      await deleteClient(client.id);

      await expect(getClientById(client.id)).resolves.toBeNull();
    });

    it("removes deleted-client relationships without deleting trips", async () => {
      const client = await createClient({ name: "Assigned Delete" });
      const trip = await createTrip({
        clientIds: [client.id],
        title: "Preserved Trip",
        slug: `preserved-trip-${client.id}`,
        startDate: "2026-01-01",
        endDate: "2026-01-02",
      });

      await deleteClient(client.id);

      const details = await getTripWithDetails(trip.slug);
      expect(details).not.toBeNull();
      expect(details!.id).toBe(trip.id);
      expect(details!.clients.map((assigned) => assigned.id)).not.toContain(client.id);
      await expect(getTripsByClientId(client.id)).resolves.toEqual([]);
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

  describe("deleteTrip", () => {
    it("borra el viaje y sus datos relacionados en modo mock", async () => {
      const trip = await createTrip({
        clientIds: ["c1"],
        title: "Viaje a borrar",
        slug: `viaje-a-borrar-${Date.now()}`,
        startDate: "2026-10-01",
        endDate: "2026-10-02",
      });
      const day = await createTripDay({ tripId: trip.id, date: "2026-10-01" });
      const item = await createItem({ tripDayId: day.id, type: "note", title: "Nota" });
      const tag = await getOrCreateTag(`tag-borrar-${Date.now()}`);
      await setTripTags(trip.id, [tag.id]);
      await createPackingItem({ tripId: trip.id, label: "Pasaporte" });
      await updateTripInternalNotes(trip.id, "Nota privada");
      mockTripStatusHistory.push({
        id: `hist-${trip.id}`,
        tripId: trip.id,
        fromStatus: "draft",
        toStatus: "archived",
        changedAt: new Date().toISOString(),
      });
      mockTripPhotos.push({
        id: `photo-${trip.id}`,
        tripId: trip.id,
        filePath: "mock/photo.jpg",
        fileName: "photo.jpg",
        sortOrder: 0,
        createdAt: new Date().toISOString(),
      });
      mockTripFeedback.push({
        id: `feedback-${trip.id}`,
        tripId: trip.id,
        rating: 5,
        comment: "ok",
        createdAt: new Date().toISOString(),
      });

      await deleteTrip(trip.id);

      expect(await getTripById(trip.id)).toBeNull();
      expect(mockTrips.some((row) => row.id === trip.id)).toBe(false);
      expect(mockTripDays.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockItems.some((row) => row.id === item.id)).toBe(false);
      expect(mockTripClients.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockTripTags.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockPackingItems.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockTripStatusHistory.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockTripPhotos.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockTripFeedback.some((row) => row.tripId === trip.id)).toBe(false);
      expect(mockTripInternalNotes[trip.id]).toBeUndefined();
    });
  });


  describe("getTripsWithClients filters", () => {
    it("filtra viajes por status, moneda, cliente y tags en modo mock", async () => {
      const result = await getTripsWithClients({
        filters: {
          status: ["published"],
          currency: "EUR",
          clientIds: ["c1"],
          tagIds: ["tg1"],
        },
      });

      expect(result.items.map((trip) => trip.id)).toEqual(["t1"]);
      expect(result.totalCount).toBe(1);
    });

    it("filtra texto con acentos en título, instrucciones y cliente", async () => {
      const byTitle = await getTripsWithClients({ filters: { query: "italia" } });
      const byInstructions = await getTripsWithClients({ filters: { query: "documento" } });
      const byClient = await getTripsWithClients({ filters: { query: "familia gomez" } });

      expect(byTitle.items.map((trip) => trip.id)).toContain("t1");
      expect(byInstructions.items.map((trip) => trip.id)).toContain("t1");
      expect(byClient.items.map((trip) => trip.id)).toContain("t2");
    });

    it("aplica rango de fechas inclusivo por traslape y pagina sobre resultados filtrados", async () => {
      const result = await getTripsWithClients({
        page: 1,
        pageSize: 1,
        filters: { dateFrom: "2026-12-01", dateTo: "2026-12-31" },
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("t2");
      expect(result.totalCount).toBe(1);
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

  describe("supplier Google place metadata", () => {
    it("preserves Google place metadata when creating a supplier", async () => {
      const created = await createSupplier({
        name: "Hotel Google Test",
        type: "hotel",
        address: "Av. Test 123, CDMX",
        lat: 19.432608,
        lng: -99.133209,
        googlePlaceId: "ChIJ-google-test",
        tags: ["google"],
      });

      expect(created.googlePlaceId).toBe("ChIJ-google-test");
      expect(created.address).toBe("Av. Test 123, CDMX");
      expect(created.lat).toBe(19.432608);
      expect(created.lng).toBe(-99.133209);

      const found = await getSupplierById(created.id);
      expect(found?.googlePlaceId).toBe("ChIJ-google-test");
    });

    it("preserves Google place metadata when updating a supplier", async () => {
      const created = await createSupplier({
        name: "Proveedor Manual",
        type: "restaurant",
        tags: [],
      });

      const updated = await updateSupplier(created.id, {
        address: "Calle Actualizada 456, Puebla",
        lat: 19.04144,
        lng: -98.20627,
        googlePlaceId: "ChIJ-updated-place",
      });

      expect(updated.googlePlaceId).toBe("ChIJ-updated-place");
      expect(updated.address).toBe("Calle Actualizada 456, Puebla");
      expect(updated.lat).toBe(19.04144);
      expect(updated.lng).toBe(-98.20627);
    });

    it("enriches only confirmed Google fields while preserving existing supplier details", async () => {
      const created = await createSupplier({
        name: "Hotel Curado",
        type: "hotel",
        contactPhone: "+52 55 0000 0000",
        contactEmail: "reservas@example.com",
        website: "https://hotel.example.com",
        notes: "Notas internas",
        tags: ["vip"],
      });

      const enriched = await updateSupplier(created.id, {
        address: "Paseo de la Reforma 1, CDMX",
        lat: 19.433,
        lng: -99.133,
        googlePlaceId: "ChIJ-confirmed-enrichment",
      });

      expect(enriched.name).toBe("Hotel Curado");
      expect(enriched.type).toBe("hotel");
      expect(enriched.contactPhone).toBe("+52 55 0000 0000");
      expect(enriched.contactEmail).toBe("reservas@example.com");
      expect(enriched.website).toBe("https://hotel.example.com");
      expect(enriched.notes).toBe("Notas internas");
      expect(enriched.tags).toEqual(["vip"]);
      expect(enriched.address).toBe("Paseo de la Reforma 1, CDMX");
      expect(enriched.lat).toBe(19.433);
      expect(enriched.lng).toBe(-99.133);
      expect(enriched.googlePlaceId).toBe("ChIJ-confirmed-enrichment");
    });
  });

});

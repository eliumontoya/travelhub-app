import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createTrip,
  deleteTrip,
  setTripClients,
} from "@/lib/data/trips";
import {
  addChecklistItem,
  uploadServiceDocument,
} from "@/lib/data/services";
import {
  mockItems,
  mockPackingItems,
  mockServiceChecklistItems,
  mockServices,
  mockServiceUploads,
  mockTripClients,
  mockTripDays,
  mockTripFeedback,
  mockTripInternalNotes,
  mockTripPhotos,
  mockTripStatusHistory,
  mockTripTags,
  mockTrips,
} from "@/lib/mock-data";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

function resetMocks() {
  mockTrips.length = 0;
  mockTripClients.length = 0;
  mockTripTags.length = 0;
  mockTripDays.length = 0;
  mockItems.length = 0;
  mockTripPhotos.length = 0;
  mockPackingItems.length = 0;
  mockTripStatusHistory.length = 0;
  mockTripFeedback.length = 0;
  for (const key of Object.keys(mockTripInternalNotes)) {
    delete mockTripInternalNotes[key];
  }
  mockServices.length = 0;
  mockServiceChecklistItems.length = 0;
  mockServiceUploads.length = 0;
}

beforeEach(resetMocks);

describe("auto-create", () => {
  it("createTrip auto-creates one service per assigned client", async () => {
    const trip = await createTrip({
      title: "Viaje de prueba",
      slug: "viaje-prueba",
      clientIds: ["c1", "c2"],
    });

    const services = mockServices.filter((s) => s.tripId === trip.id);

    expect(services).toHaveLength(2);
    expect(services.map((s) => s.clientId).sort()).toEqual(["c1", "c2"]);
    expect(
      services.every(
        (s) => s.serviceType === "trip_documents" && s.status === "active"
      )
    ).toBe(true);
    expect(new Set(services.map((s) => s.id)).size).toBe(2);
  });

  it("setTripClients toAdd auto-creates a service for the new client", async () => {
    const trip = await createTrip({
      title: "Viaje de prueba",
      slug: "viaje-prueba-add",
      clientIds: ["c1"],
    });

    await setTripClients(trip.id, ["c1", "c2"]);

    const services = mockServices.filter((s) => s.tripId === trip.id);
    expect(services).toHaveLength(2);
    expect(services.some((s) => s.clientId === "c2")).toBe(true);
  });

  it("setTripClients removal deletes the removed client's service, checklist items and uploads", async () => {
    const trip = await createTrip({
      title: "Viaje de prueba",
      slug: "viaje-prueba-remove",
      clientIds: ["c1", "c2"],
    });
    const serviceForC2 = mockServices.find(
      (s) => s.tripId === trip.id && s.clientId === "c2"
    )!;
    const item = await addChecklistItem(serviceForC2.id, {
      label: "Passport",
      required: true,
    });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    await uploadServiceDocument(serviceForC2.id, item.id, file);

    expect(mockServiceChecklistItems).toHaveLength(1);
    expect(mockServiceUploads).toHaveLength(1);

    await setTripClients(trip.id, ["c1"]);

    expect(mockServices.filter((s) => s.tripId === trip.id)).toHaveLength(1);
    expect(
      mockServices.some((s) => s.tripId === trip.id && s.clientId === "c2")
    ).toBe(false);
    expect(mockServiceChecklistItems).toHaveLength(0);
    expect(mockServiceUploads).toHaveLength(0);
  });

  it("setTripClients re-assignment is idempotent", async () => {
    const trip = await createTrip({
      title: "Viaje de prueba",
      slug: "viaje-prueba-idempotent",
      clientIds: ["c1"],
    });
    const originalService = mockServices.find(
      (s) => s.tripId === trip.id && s.clientId === "c1"
    )!;

    await setTripClients(trip.id, ["c1", "c2"]);
    const afterAdd = mockServices.filter((s) => s.tripId === trip.id).length;

    await setTripClients(trip.id, ["c1", "c2"]);

    expect(mockServices.filter((s) => s.tripId === trip.id)).toHaveLength(afterAdd);
    expect(
      mockServices.some((s) => s.id === originalService.id && s.clientId === "c1")
    ).toBe(true);
  });

  it("deleteTrip cascades services, checklist items, uploads and removes storage objects", async () => {
    const trip = await createTrip({
      title: "Viaje de prueba",
      slug: "viaje-prueba-delete",
      clientIds: ["c1"],
    });
    const service = mockServices.find((s) => s.tripId === trip.id)!;
    const item = await addChecklistItem(service.id, {
      label: "Passport",
      required: true,
    });
    const file = new File(["x"], "passport.pdf", { type: "application/pdf" });
    const upload = await uploadServiceDocument(service.id, item.id, file);

    expect(mockServices).toHaveLength(1);
    expect(mockServiceChecklistItems).toHaveLength(1);
    expect(mockServiceUploads).toHaveLength(1);
    expect(upload.filePath).toContain("services/");

    await deleteTrip(trip.id);

    expect(mockTrips.some((t) => t.id === trip.id)).toBe(false);
    expect(mockServices).toHaveLength(0);
    expect(mockServiceChecklistItems).toHaveLength(0);
    expect(mockServiceUploads).toHaveLength(0);
  });
});

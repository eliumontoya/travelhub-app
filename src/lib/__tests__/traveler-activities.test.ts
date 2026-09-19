import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

import {
  canClientAddActivities,
  createTravelerActivity,
  deleteTravelerActivity,
  getTripById,
  rowToItem,
  updateTravelerActivity,
} from "@/lib/data";
import { editItemAction } from "@/app/dashboard/trips/[id]/actions";
import { mockItems, mockTripClients, mockTripDays, mockTrips } from "@/lib/mock-data";
import type { Item } from "@/types";

const initialTrips = structuredClone(mockTrips);
const initialDays = structuredClone(mockTripDays);
const initialItems = structuredClone(mockItems);
const initialAssignments = structuredClone(mockTripClients);

function resetMockData() {
  mockTrips.splice(0, mockTrips.length, ...structuredClone(initialTrips));
  mockTripDays.splice(0, mockTripDays.length, ...structuredClone(initialDays));
  mockItems.splice(0, mockItems.length, ...structuredClone(initialItems));
  mockTripClients.splice(0, mockTripClients.length, ...structuredClone(initialAssignments));
}

function travelerInput(overrides: Partial<{
  tripId: string;
  tripDayId: string;
  clientId: string;
  title: string;
  startTime: string;
  location: string;
  notes: string;
}> = {}) {
  return {
    tripId: "t1",
    tripDayId: "d1",
    clientId: "c1",
    title: "Traveler museum visit",
    ...overrides,
  };
}

describe("traveler activity data operations", () => {
  beforeEach(resetMockData);

  it("creates a sanitized attributed activity for an assigned traveler on a published active day", async () => {
    const result = await createTravelerActivity(travelerInput({
      startTime: "09:30",
      location: "Museum",
      notes: "<strong>Meet at entrance</strong><script>alert(1)</script>",
    }));

    expect(result).toMatchObject({
      ok: true,
      item: {
        type: "activity",
        createdByClientId: "c1",
        title: "Traveler museum visit",
        startTime: "09:30",
        location: "Museum",
      },
    });
    if (result.ok) expect(result.item.notes).not.toContain("<script");
  });

  it("rejects overlong fields and invalid time without persisting", async () => {
    const before = mockItems.length;

    await expect(createTravelerActivity(travelerInput({ title: "x".repeat(121) })))
      .resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(createTravelerActivity(travelerInput({ startTime: "25:00" })))
      .resolves.toEqual({ ok: false, reason: "invalid" });

    expect(mockItems).toHaveLength(before);
  });

  it("accepts assigned clients only while their trip is published and day is active", async () => {
    await expect(canClientAddActivities("t1", "c1")).resolves.toBe(true);
    await expect(canClientAddActivities("t1", "c2")).resolves.toBe(false);

    mockTrips[0]!.status = "draft";
    await expect(canClientAddActivities("t1", "c1")).resolves.toBe(false);

    mockTrips[0]!.status = "archived";
    await expect(createTravelerActivity(travelerInput())).resolves.toEqual({ ok: false, reason: "unauthorized" });

    mockTrips[0]!.status = "published";
    mockTripDays.find((day) => day.id === "d1")!.deletedAt = "2026-09-18T00:00:00.000Z";
    await expect(createTravelerActivity(travelerInput())).resolves.toEqual({ ok: false, reason: "unauthorized" });
  });

  it("returns the same unauthorized result for missing assignment and wrong trip or day", async () => {
    await expect(createTravelerActivity(travelerInput({ clientId: "c2" })))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });
    await expect(createTravelerActivity(travelerInput({ tripId: "t2" })))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });
    await expect(createTravelerActivity(travelerInput({ tripDayId: "d2", tripId: "t2" })))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });
  });

  it("preserves existing traveler activities when the trip lifecycle later blocks writes", async () => {
    const created = await createTravelerActivity(travelerInput({
      title: "Archived lifecycle museum visit",
      startTime: "11:45",
      location: "Capitoline Museums",
      notes: "Keep visible in stored itinerary data",
    }));
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    mockTrips[0]!.status = "archived";

    await expect(createTravelerActivity(travelerInput({ title: "Blocked after archive" })))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });

    const storedTrip = await getTripById("t1");
    const storedItem = storedTrip?.days
      .flatMap((day) => day.items)
      .find((item) => item.id === created.item.id);

    expect(storedItem).toMatchObject({
      id: created.item.id,
      title: "Archived lifecycle museum visit",
      startTime: "11:45",
      location: "Capitoline Museums",
      notes: "Keep visible in stored itinerary data",
      createdByClientId: "c1",
    });
  });

  it("allows owners to edit and soft-delete only their active activities", async () => {
    const created = await createTravelerActivity(travelerInput());
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    await expect(updateTravelerActivity({ ...travelerInput(), itemId: created.item.id, title: "Updated title" }))
      .resolves.toMatchObject({ ok: true, item: { title: "Updated title" } });
    await expect(deleteTravelerActivity({ tripId: "t1", tripDayId: "d1", clientId: "c1", itemId: created.item.id }))
      .resolves.toEqual({ ok: true });
    await expect(updateTravelerActivity({ ...travelerInput(), itemId: created.item.id }))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });
  });

  it("rejects cross-client and null-owner agent items without revealing or mutating them", async () => {
    const otherOwner = {
      id: "traveler-owned",
      tripDayId: "d1",
      type: "activity" as const,
      title: "Other traveler item",
      sortOrder: 99,
      metadata: null,
      createdByClientId: "c2",
    } satisfies Item;
    const agentItem = {
      id: "agent-item",
      tripDayId: "d1",
      type: "activity" as const,
      title: "Agent item",
      sortOrder: 100,
      metadata: null,
      createdByClientId: null,
    } satisfies Item;
    mockItems.push(otherOwner, agentItem);

    await expect(updateTravelerActivity({ ...travelerInput(), itemId: otherOwner.id, title: "Tampered" }))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });
    await expect(deleteTravelerActivity({ tripId: "t1", tripDayId: "d1", clientId: "c1", itemId: agentItem.id }))
      .resolves.toEqual({ ok: false, reason: "unauthorized" });

    expect(mockItems.find((item) => item.id === otherOwner.id)?.title).toBe("Other traveler item");
    expect(mockItems.find((item) => item.id === agentItem.id)?.deletedAt).toBeUndefined();
  });

  it("maps absent creator attribution as null for legacy and agent rows", () => {
    expect(rowToItem({
      id: "legacy-item",
      trip_day_id: "d1",
      type: "activity",
      title: "Legacy activity",
      sort_order: 0,
      item_metadata: null,
      created_by_client_id: null,
    }).createdByClientId).toBeNull();
  });

  it("preserves the agent published-trip lock", async () => {
    const formData = new FormData();
    formData.set("type", "activity");
    formData.set("title", "Agent change");
    formData.set("metadata", "null");

    await expect(editItemAction("t1", "i3", formData)).rejects.toThrow("viaje publicado está bloqueado");
    expect(mockItems.find((item) => item.id === "i3")?.title).toBe("Tour privado Coliseo Romano");
  });
});

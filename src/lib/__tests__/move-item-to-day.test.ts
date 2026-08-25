import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import { createTripDay, createItem, moveItemToDay, getItemById } from "@/lib/data";

describe("moveItemToDay (mock mode)", () => {
  it("reassigns the item to the target day, preserving all fields", async () => {
    const dayA = await createTripDay({ tripId: "trip-move", date: "2030-06-01" });
    const dayB = await createTripDay({ tripId: "trip-move", date: "2030-06-02" });
    const item = await createItem({
      tripDayId: dayA.id,
      type: "activity",
      title: "Tour guiado",
      startTime: "09:00",
      location: "Centro",
      cost: 100,
      metadata: { activityName: "Tour" },
    });

    await moveItemToDay(item.id, dayB.id);

    const moved = await getItemById(item.id);
    expect(moved).not.toBeNull();
    expect(moved!.tripDayId).toBe(dayB.id);
    // Only trip_day_id and sort_order change; every other field is preserved.
    expect(moved!.title).toBe("Tour guiado");
    expect(moved!.type).toBe("activity");
    expect(moved!.startTime).toBe("09:00");
    expect(moved!.location).toBe("Centro");
    expect(moved!.cost).toBe(100);
    expect(moved!.metadata).toMatchObject({ activityName: "Tour" });
  });

  it("appends the moved item at the end of the destination day", async () => {
    const dayA = await createTripDay({ tripId: "trip-move-2", date: "2030-07-01" });
    const dayB = await createTripDay({ tripId: "trip-move-2", date: "2030-07-02" });
    const existing = await createItem({ tripDayId: dayB.id, type: "note", title: "Existente" });
    const item = await createItem({ tripDayId: dayA.id, type: "note", title: "A mover" });

    await moveItemToDay(item.id, dayB.id);

    const moved = await getItemById(item.id);
    expect(moved!.sortOrder).toBeGreaterThan(existing.sortOrder);
  });

  it("no-ops silently when the item does not exist", async () => {
    const dayB = await createTripDay({ tripId: "trip-move-3", date: "2030-08-01" });
    await expect(moveItemToDay("does-not-exist", dayB.id)).resolves.toBeUndefined();
  });
});

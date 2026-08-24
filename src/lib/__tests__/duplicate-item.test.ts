import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import { createTripDay, createItem, duplicateItem, getItemById } from "@/lib/data";

describe("duplicateItem (mock mode)", () => {
  it("creates a copy in the target day preserving fields and metadata", async () => {
    const sourceDay = await createTripDay({ tripId: "trip-dup", date: "2030-01-01" });
    const targetDay = await createTripDay({ tripId: "trip-dup", date: "2030-01-02" });

    const source = await createItem({
      tripDayId: sourceDay.id,
      type: "activity",
      title: "Tour guiado",
      startTime: "09:00",
      location: "Centro",
      cost: 100,
      metadata: { activityName: "Tour", provider: "Acme", address: "Calle 1", startTime: "09:00", endTime: "11:00" },
    });

    const copy = await duplicateItem(source.id, targetDay.id);

    expect(copy.id).not.toBe(source.id);
    expect(copy.tripDayId).toBe(targetDay.id);
    expect(copy.title).toBe("Tour guiado");
    expect(copy.type).toBe("activity");
    expect(copy.startTime).toBe("09:00");
    expect(copy.location).toBe("Centro");
    expect(copy.cost).toBe(100);
    expect(copy.metadata).toMatchObject({ activityName: "Tour" });

    const fetched = await getItemById(copy.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.tripDayId).toBe(targetDay.id);
  });

  it("appends the copy at the end of the destination day", async () => {
    const day = await createTripDay({ tripId: "trip-dup-2", date: "2030-02-01" });
    const first = await createItem({ tripDayId: day.id, type: "note", title: "Uno" });
    const second = await createItem({ tripDayId: day.id, type: "note", title: "Dos" });

    const copy = await duplicateItem(first.id, day.id);
    expect(copy.sortOrder).toBeGreaterThanOrEqual(second.sortOrder);
  });

  it("returns null-safe error when source is missing", async () => {
    const day = await createTripDay({ tripId: "trip-dup-3", date: "2030-03-01" });
    await expect(duplicateItem("does-not-exist", day.id)).rejects.toThrow();
  });
});

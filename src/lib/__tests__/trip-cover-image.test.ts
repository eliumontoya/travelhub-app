import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import {
  createTrip,
  updateTrip,
  removeTripCoverImage,
  uploadTripCoverImage,
  getTripById,
  storagePathFromPublicUrl,
} from "@/lib/data";

describe("storagePathFromPublicUrl", () => {
  it("derives the storage path from a public URL", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/public/trip-photos/covers/t1/123-cover.jpg";
    expect(storagePathFromPublicUrl("trip-photos", url)).toBe("covers/t1/123-cover.jpg");
  });

  it("returns null when the marker is missing", () => {
    expect(storagePathFromPublicUrl("trip-photos", "https://example.com/other.jpg")).toBeNull();
  });
});

describe("trip cover image (mock mode)", () => {
  it("persists the cover image URL", async () => {
    const trip = await createTrip({
      title: "Viaje Cover",
      slug: `viaje-cover-${Date.now().toString(36)}`,
      clientIds: ["c1"],
    });
    const updated = await updateTrip(trip.id, {
      coverImageUrl: "https://example.com/covers/trip.jpg",
    });
    expect(updated.coverImageUrl).toBe("https://example.com/covers/trip.jpg");

    const fetched = await getTripById(trip.id);
    expect(fetched!.coverImageUrl).toBe("https://example.com/covers/trip.jpg");
  });

  it("clears the cover image URL on remove", async () => {
    const trip = await createTrip({
      title: "Viaje Cover 2",
      slug: `viaje-cover-2-${Date.now().toString(36)}`,
      clientIds: ["c1"],
    });
    await updateTrip(trip.id, {
      coverImageUrl: "https://example.com/covers/trip.jpg",
    });

    await removeTripCoverImage(trip.id);

    const after = await getTripById(trip.id);
    expect(after!.coverImageUrl).toBeUndefined();
  });

  it("upload throws in mock mode", async () => {
    const trip = await createTrip({
      title: "Viaje Cover 3",
      slug: `viaje-cover-3-${Date.now().toString(36)}`,
      clientIds: ["c1"],
    });
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });
    await expect(uploadTripCoverImage(trip.id, file)).rejects.toThrow(
      "Supabase no está configurado"
    );
  });
});

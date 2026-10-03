import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test (migration pattern "a" — see helpers/db.ts): the Supabase
 * client + storage are mocked and `isSupabaseConfigured()` returns true, so
 * the real Supabase branch of `src/lib/data/documents.ts` runs. We assert the
 * query/storage shapes and the returned URL/row mapping.
 */
const state = vi.hoisted(() => {
  interface Call {
    table: string;
    method: string;
    args: unknown[];
  }
  interface StorageCall {
    bucket: string;
    method: string;
    args: unknown[];
  }

  const calls: Call[] = [];
  const storageCalls: StorageCall[] = [];
  let tripRow: Record<string, unknown> | null = null;

  function baseTrip(): Record<string, unknown> {
    return {
      id: "trip-1",
      client_id: "c1",
      title: "Viaje",
      slug: "viaje",
      start_date: null,
      end_date: null,
      cover_image_url: null,
      instructions: null,
      status: "draft",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      traveler_count: 1,
      currency: "MXN",
      is_template: false,
      show_costs_to_client: false,
    };
  }

  function createTripsBuilder() {
    const builder = {
      select(...args: unknown[]) {
        calls.push({ table: "trips", method: "select", args });
        return builder;
      },
      eq(...args: unknown[]) {
        calls.push({ table: "trips", method: "eq", args });
        return builder;
      },
      update(...args: unknown[]) {
        calls.push({ table: "trips", method: "update", args });
        const patch = args[0] as Record<string, unknown>;
        tripRow = { ...baseTrip(), ...(tripRow ?? {}), ...patch };
        return builder;
      },
      async maybeSingle() {
        calls.push({ table: "trips", method: "maybeSingle", args: [] });
        return { data: tripRow, error: null };
      },
      async single() {
        calls.push({ table: "trips", method: "single", args: [] });
        return { data: tripRow, error: null };
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: tripRow, error: null }).then(resolve);
      },
    };
    return builder;
  }

  function createStorageBucket(bucket: string) {
    return {
      async upload(...args: unknown[]) {
        storageCalls.push({ bucket, method: "upload", args });
        return { data: { path: args[0] }, error: null };
      },
      getPublicUrl(...args: unknown[]) {
        storageCalls.push({ bucket, method: "getPublicUrl", args });
        return {
          data: {
            publicUrl: `https://testsupabase.local/storage/v1/object/public/${bucket}/${args[0]}`,
          },
        };
      },
      async remove(...args: unknown[]) {
        storageCalls.push({ bucket, method: "remove", args });
        return { data: null, error: null };
      },
    };
  }

  const client = {
    from: (table: string) => createTripsBuilder(),
    storage: { from: (bucket: string) => createStorageBucket(bucket) },
  };

  return {
    calls,
    storageCalls,
    client,
    baseTrip,
    reset() {
      calls.length = 0;
      storageCalls.length = 0;
      tripRow = null;
    },
    setTrip(row: Record<string, unknown> | null) {
      tripRow = row;
    },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: async () => state.client,
}));

import {
  updateTrip,
  removeTripCoverImage,
  uploadTripCoverImage,
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

describe("trip cover image (Supabase contract)", () => {
  beforeEach(() => state.reset());

  it("updateTrip persists cover_image_url and maps the returned row", async () => {
    state.setTrip(state.baseTrip());

    const updated = await updateTrip("trip-1", {
      coverImageUrl: "https://cdn.test/covers/trip.jpg",
    });

    expect(state.calls).toEqual([
      { table: "trips", method: "update", args: [{ cover_image_url: "https://cdn.test/covers/trip.jpg" }] },
      { table: "trips", method: "eq", args: ["id", "trip-1"] },
      { table: "trips", method: "select", args: [] },
      { table: "trips", method: "single", args: [] },
    ]);
    expect(updated.coverImageUrl).toBe("https://cdn.test/covers/trip.jpg");
  });

  it("updateTrip with null clears the column (row mapping yields undefined)", async () => {
    state.setTrip({ ...state.baseTrip(), cover_image_url: "https://cdn.test/covers/old.jpg" });

    const updated = await updateTrip("trip-1", { coverImageUrl: null });

    const updateCall = state.calls.find((call) => call.method === "update");
    expect(updateCall?.args).toEqual([{ cover_image_url: null }]);
    expect(updated.coverImageUrl).toBeUndefined();
  });

  it("removeTripCoverImage deletes the stored object then nulls the column", async () => {
    state.setTrip({
      ...state.baseTrip(),
      cover_image_url:
        "https://xyz.supabase.co/storage/v1/object/public/trip-photos/covers/t1/123-cover.jpg",
    });

    await removeTripCoverImage("trip-1");

    expect(state.storageCalls).toEqual([
      { bucket: "trip-photos", method: "remove", args: [["covers/t1/123-cover.jpg"]] },
    ]);
    expect(state.calls).toEqual([
      { table: "trips", method: "select", args: ["cover_image_url"] },
      { table: "trips", method: "eq", args: ["id", "trip-1"] },
      { table: "trips", method: "maybeSingle", args: [] },
      { table: "trips", method: "update", args: [{ cover_image_url: null }] },
      { table: "trips", method: "eq", args: ["id", "trip-1"] },
    ]);
  });

  it("removeTripCoverImage skips storage removal when there is no prior cover", async () => {
    state.setTrip(state.baseTrip());

    await removeTripCoverImage("trip-1");

    expect(state.storageCalls).toEqual([]);
    const updateCall = state.calls.find((call) => call.method === "update");
    expect(updateCall?.args).toEqual([{ cover_image_url: null }]);
  });

  it("uploadTripCoverImage uploads under covers/{tripId} and persists the public URL", async () => {
    state.setTrip(state.baseTrip());
    const file = new File(["x"], "cover.jpg", { type: "image/jpeg" });

    const url = await uploadTripCoverImage("trip-1", file);

    const uploadCall = state.storageCalls.find((call) => call.method === "upload");
    expect(uploadCall?.bucket).toBe("trip-photos");
    expect(uploadCall?.args[0]).toMatch(/^covers\/trip-1\/\d+-cover\.jpg$/);
    expect(uploadCall?.args[1]).toBe(file);
    expect(uploadCall?.args[2]).toEqual({ contentType: "image/jpeg" });

    expect(url).toMatch(
      /^https:\/\/testsupabase\.local\/storage\/v1\/object\/public\/trip-photos\/covers\/trip-1\/\d+-cover\.jpg$/
    );
    const updateCall = state.calls.find((call) => call.method === "update");
    expect(updateCall?.args).toEqual([{ cover_image_url: url }]);
  });

  it("uploadTripCoverImage removes the previous cover object before uploading", async () => {
    state.setTrip({
      ...state.baseTrip(),
      cover_image_url:
        "https://xyz.supabase.co/storage/v1/object/public/trip-photos/covers/trip-1/old-cover.jpg",
    });
    const file = new File(["x"], "new.jpg", { type: "image/jpeg" });

    await uploadTripCoverImage("trip-1", file);

    expect(state.storageCalls[0]).toEqual({
      bucket: "trip-photos",
      method: "remove",
      args: [["covers/trip-1/old-cover.jpg"]],
    });
    expect(state.storageCalls[1]?.method).toBe("upload");
  });
});

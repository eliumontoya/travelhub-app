import { describe, expect, it, vi } from "vitest";

const queriedTables: string[] = [];

const rowsByTable: Record<string, Record<string, unknown>[]> = {
  trips: [
    {
      id: "trip-public-1",
      client_id: "client-private-1",
      title: "Safari Africa",
      slug: "safari-africa",
      start_date: "2027-01-10",
      end_date: "2027-01-18",
      cover_image_url: "https://example.com/safari.jpg",
      instructions: "Bienvenidos",
      status: "published",
      created_at: "2026-08-24T00:00:00.000Z",
      updated_at: "2026-08-24T00:00:00.000Z",
      traveler_count: 2,
      currency: "MXN",
      is_template: false,
      show_costs_to_client: false,
    },
  ],
  trip_photos: [],
  trip_days: [],
  trip_documents: [],
  packing_items: [
    {
      id: "packing-1",
      trip_id: "trip-public-1",
      label: "Pasaporte",
      checked: false,
      sort_order: 0,
    },
  ],
};

function createQuery(table: string) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    is: vi.fn(() => query),
    in: vi.fn(() => query),
    order: vi.fn(async () => ({ data: rowsByTable[table] ?? [], error: null })),
    maybeSingle: vi.fn(async () => ({ data: rowsByTable[table]?.[0] ?? null, error: null })),
  };
  return query;
}

const supabase = {
  from: vi.fn((table: string) => {
    queriedTables.push(table);
    if (table === "trip_clients" || table === "trip_tags" || table === "trip_status_history") {
      throw new Error(`Public trip render must not query private dashboard table ${table}`);
    }
    return createQuery(table);
  }),
  storage: {
    from: vi.fn(() => ({
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: "https://example.com/photo.jpg" } })),
    })),
  },
};

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => true,
  createClient: vi.fn(async () => supabase),
}));

import { getTripWithDetails } from "@/lib/data";

describe("public trip details", () => {
  it("assembles /t/[slug] without reading private dashboard relation tables", async () => {
    queriedTables.length = 0;

    const trip = await getTripWithDetails("safari-africa");

    expect(trip?.coverImageUrl).toBe("https://example.com/safari.jpg");
    expect(trip?.packingItems).toEqual([
      { id: "packing-1", tripId: "trip-public-1", label: "Pasaporte", checked: false, sortOrder: 0 },
    ]);
    expect(queriedTables).toEqual([
      "trips",
      "trip_photos",
      "trip_days",
      "trip_documents",
      "packing_items",
    ]);
    expect(queriedTables).not.toContain("trip_clients");
    expect(queriedTables).not.toContain("trip_tags");
    expect(queriedTables).not.toContain("trip_status_history");
  });
});

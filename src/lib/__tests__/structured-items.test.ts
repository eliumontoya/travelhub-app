import { describe, expect, expectTypeOf, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import { appendSerializedMetadata } from "@/components/ItemFormDialog";
import { createItem, updateItem } from "@/lib/data";
import { validateItemMetadata } from "@/lib/item-metadata-schemas";
import { FlightMetadata, HotelMetadata, Item } from "@/types";

describe("structured item metadata validation", () => {
  it("accepts valid flight metadata and preserves required fields", () => {
    const metadata = validateItemMetadata("flight", {
      airline: "AA",
      flightNumber: "1234",
      departureAirport: "MEX",
      arrivalAirport: "JFK",
      departureTime: "09:30",
      arrivalTime: "15:10",
    });

    expect(metadata).toMatchObject({ airline: "AA", flightNumber: "1234" });
  });

  it("accepts partial flight metadata", () => {
    expect(validateItemMetadata("flight", {
      airline: "AA",
      flightNumber: "1234",
    })).toMatchObject({ airline: "AA", flightNumber: "1234" });
  });

  it("accepts null metadata for any item type", () => {
    expect(validateItemMetadata("flight", null)).toBeNull();
    expect(validateItemMetadata("hotel", null)).toBeNull();
    expect(validateItemMetadata("note", null)).toBeNull();
  });
});

describe("structured item metadata persistence", () => {
  it("clears stale metadata when an edit sends empty metadata", async () => {
    const created = await createItem({
      tripDayId: "d1",
      type: "hotel",
      title: "Hotel con metadata",
      metadata: {
        hotelName: "Hotel Demo",
        address: "Calle 1",
        checkIn: "2026-09-10",
        checkOut: "2026-09-11",
        roomType: "Suite",
        boardBasis: "Todo incluido",
      },
    });

    const updated = await updateItem(created.id, {
      type: "flight",
      title: "Vuelo sin metadata",
      metadata: null,
    });

    expect(updated.type).toBe("flight");
    expect(updated.metadata).toBeNull();
  });
});

describe("structured item metadata form serialization", () => {
  it("serializes blank type-specific fields as null metadata", () => {
    const formData = new FormData();
    formData.set("metadata_airline", "");
    formData.set("metadata_flightNumber", "   ");

    appendSerializedMetadata(formData, "flight");

    expect(formData.get("metadata")).toBe("null");
    expect(formData.has("metadata_airline")).toBe(false);
    expect(formData.has("metadata_flightNumber")).toBe(false);
  });

  it("serializes partial type-specific fields into metadata JSON", () => {
    const formData = new FormData();
    formData.set("metadata_provider", "Local Guide");
    formData.set("metadata_duration", "2h");
    formData.set("metadata_bookingReference", "ACT-123");

    appendSerializedMetadata(formData, "activity");

    expect(JSON.parse(String(formData.get("metadata")))).toMatchObject({
      provider: "Local Guide",
      duration: "2h",
      bookingReference: "ACT-123",
    });
    expect(formData.has("metadata_provider")).toBe(false);
    expect(formData.has("metadata_duration")).toBe(false);
    expect(formData.has("metadata_bookingReference")).toBe(false);
  });

  it("serializes filled type-specific fields into metadata JSON", () => {
    const formData = new FormData();
    formData.set("metadata_airline", "AA");
    formData.set("metadata_flightNumber", "1234");
    formData.set("metadata_departureAirport", "MEX");
    formData.set("metadata_arrivalAirport", "JFK");
    formData.set("metadata_departureTime", "09:30");
    formData.set("metadata_arrivalTime", "15:10");

    appendSerializedMetadata(formData, "flight");

    expect(JSON.parse(String(formData.get("metadata")))).toMatchObject({
      airline: "AA",
      flightNumber: "1234",
      departureAirport: "MEX",
      arrivalAirport: "JFK",
      departureTime: "09:30",
      arrivalTime: "15:10",
    });
  });
});

describe("structured item discriminated union typing", () => {
  it("narrows metadata by item type", () => {
    expectTypeOf<Extract<Item, { type: "flight" }>["metadata"]>().toEqualTypeOf<FlightMetadata | null>();
    expectTypeOf<Extract<Item, { type: "hotel" }>["metadata"]>().toEqualTypeOf<HotelMetadata | null>();
    expectTypeOf<Extract<Item, { type: "note" }>["metadata"]>().toEqualTypeOf<null>();
  });
});

import { getFlightStatus } from "@/lib/flight-status";
import { formatItemMetadataSummary, getItemFlightNumber } from "@/lib/item-display";
import { rowToItem } from "@/lib/data";

function itemWith(overrides: Partial<Item> & Pick<Item, "type" | "metadata">): Item {
  return {
    id: "item-1",
    tripDayId: "day-1",
    title: "Item demo",
    sortOrder: 0,
    ...overrides,
  } as Item;
}

describe("structured item metadata type switching", () => {
  it("keeps provided shared bookingReference when switching item type", () => {
    const formData = new FormData();
    formData.set("metadata_bookingReference", "HOTEL-STALE");

    appendSerializedMetadata(formData, "flight");

    expect(JSON.parse(String(formData.get("metadata")))).toMatchObject({
      bookingReference: "HOTEL-STALE",
    });
  });

  it("keeps shared optional bookingReference when the current flight schema is filled", () => {
    const formData = new FormData();
    formData.set("metadata_airline", "AA");
    formData.set("metadata_flightNumber", "1234");
    formData.set("metadata_departureAirport", "MEX");
    formData.set("metadata_arrivalAirport", "JFK");
    formData.set("metadata_departureTime", "09:30");
    formData.set("metadata_arrivalTime", "15:10");
    formData.set("metadata_bookingReference", "FLIGHT-REF");

    appendSerializedMetadata(formData, "flight");

    expect(JSON.parse(String(formData.get("metadata")))).toMatchObject({
      flightNumber: "1234",
      bookingReference: "FLIGHT-REF",
    });
  });
});

describe("structured item render summaries", () => {
  it("formats editor/public/quote flight metadata details", () => {
    const item = itemWith({
      type: "flight",
      title: "Flight to NY",
      metadata: {
        airline: "AA",
        flightNumber: "1234",
        departureAirport: "MEX",
        arrivalAirport: "JFK",
        departureTime: "09:30",
        arrivalTime: "15:10",
      },
    });

    expect(formatItemMetadataSummary(item)).toBe("AA 1234 · MEX → JFK");
    expect(getItemFlightNumber(item)).toBe("1234");
  });

  it("formats editor/public/quote hotel, activity, restaurant, and transport details", () => {
    expect(formatItemMetadataSummary(itemWith({
      type: "hotel",
      metadata: {
        hotelName: "Hotel Demo",
        address: "Calle 1",
        checkIn: "2026-09-10",
        checkOut: "2026-09-11",
        roomType: "Suite",
        boardBasis: "All Inclusive",
      },
    }))).toBe("Suite · All Inclusive");
    expect(formatItemMetadataSummary(itemWith({
      type: "activity",
      metadata: {
        activityName: "Tour",
        provider: "Local Guide",
        address: "Centro",
        startTime: "10:00",
        endTime: "12:00",
        duration: "2h",
      },
    }))).toBe("Local Guide · 2h");
    expect(formatItemMetadataSummary(itemWith({
      type: "restaurant",
      metadata: {
        restaurantName: "Casa Azul",
        address: "Centro",
        cuisine: "Mexicana",
      },
    }))).toBe("Mexicana");
    expect(formatItemMetadataSummary(itemWith({
      type: "transport",
      metadata: {
        company: "Transfer Co",
        pickupLocation: "Hotel",
        dropoffLocation: "Airport",
        pickupTime: "07:00",
        vehicleType: "Van",
      },
    }))).toBe("Transfer Co · Van");
  });

  it("returns generic fallback signal for note and legacy null metadata", () => {
    expect(formatItemMetadataSummary(itemWith({ type: "note", metadata: null }))).toBeNull();
    expect(formatItemMetadataSummary(itemWith({ type: "flight", title: "AA 1234", metadata: null }))).toBeNull();
    expect(getItemFlightNumber(itemWith({ type: "flight", title: "AA 1234", metadata: null }))).toBeNull();
  });
});

describe("flight status flight number resolution", () => {
  it("uses the explicit metadata flight number field", async () => {
    const previousApiKey = process.env.FLIGHT_API_KEY;
    delete process.env.FLIGHT_API_KEY;

    await expect(getFlightStatus("AM 123")).resolves.toEqual({
      status: null,
      flightNumber: "AM123",
    });

    process.env.FLIGHT_API_KEY = previousApiKey;
  });

  it("does not infer a flight number from the item title", async () => {
    const previousApiKey = process.env.FLIGHT_API_KEY;
    delete process.env.FLIGHT_API_KEY;

    await expect(getFlightStatus()).resolves.toEqual({
      status: null,
      flightNumber: null,
    });

    process.env.FLIGHT_API_KEY = previousApiKey;
  });
});

describe("structured item row mapping", () => {
  const baseRow = {
    id: "row-1",
    trip_day_id: "day-1",
    type: "flight",
    title: "AA 1234",
    start_time: null,
    end_time: null,
    location: null,
    lat: null,
    lng: null,
    confirmation_code: null,
    notes: null,
    cost: null,
    sort_order: 0,
  };

  it("maps null item_metadata to metadata null", () => {
    expect(rowToItem({ ...baseRow, item_metadata: null }).metadata).toBeNull();
  });

  it("maps object and JSON string item_metadata to typed metadata", () => {
    const metadata = {
      airline: "AA",
      flightNumber: "1234",
      departureAirport: "MEX",
      arrivalAirport: "JFK",
      departureTime: "09:30",
      arrivalTime: "15:10",
    };

    expect(rowToItem({ ...baseRow, item_metadata: metadata }).metadata).toMatchObject(metadata);
    expect(rowToItem({ ...baseRow, item_metadata: JSON.stringify(metadata) }).metadata).toMatchObject(metadata);
  });
});

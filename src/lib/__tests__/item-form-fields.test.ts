import { describe, expect, it } from "vitest";
import type { FieldDef } from "@/lib/item-form-fields";
import {
  appendSerializedMetadata,
  metadataDefaultValue,
  metadataFieldsByType,
} from "@/lib/item-form-fields";
import { validateItemMetadata } from "@/lib/item-metadata-schemas";
import { Item, ItemType } from "@/types";

/**
 * Pin test for the item-form field schema. It pins the exact per-type field
 * sets currently inlined in `src/components/ItemFormDialog.tsx` (issue #373,
 * PR 1 of 4). Written RED-first: it must fail while
 * `@/lib/item-form-fields` does not exist, and pass after the schema is moved
 * verbatim.
 */

type ExpectedField = {
  name: string;
  required: boolean;
  type: FieldDef["type"];
  options?: { value: string; label: string }[];
};

const expectedFieldsByType: Record<ItemType, ExpectedField[]> = {
  flight: [
    { name: "airline", required: true, type: "text" },
    { name: "flightNumber", required: true, type: "text" },
    { name: "departureAirport", required: true, type: "text" },
    { name: "arrivalAirport", required: true, type: "text" },
    { name: "departureTime", required: true, type: "time" },
    { name: "arrivalTime", required: true, type: "time" },
    { name: "terminal", required: false, type: "text" },
    { name: "gate", required: false, type: "text" },
    { name: "seat", required: false, type: "text" },
    { name: "bookingReference", required: false, type: "text" },
  ],
  hotel: [
    { name: "hotelName", required: true, type: "text" },
    { name: "address", required: true, type: "text" },
    { name: "checkIn", required: true, type: "date" },
    { name: "checkOut", required: true, type: "date" },
    { name: "roomType", required: true, type: "text" },
    {
      name: "boardBasis",
      required: true,
      type: "select",
      options: [
        { value: "Solo alojamiento", label: "Solo alojamiento" },
        { value: "Desayuno incluido", label: "Desayuno incluido" },
        { value: "Media pensión", label: "Media pensión" },
        { value: "Pensión completa", label: "Pensión completa" },
        { value: "Todo incluido", label: "Todo incluido" },
      ],
    },
    { name: "bookingReference", required: false, type: "text" },
    { name: "hotelPhone", required: false, type: "text" },
    { name: "specialRequests", required: false, type: "textarea" },
  ],
  activity: [
    { name: "activityName", required: true, type: "text" },
    { name: "provider", required: true, type: "text" },
    { name: "address", required: true, type: "text" },
    { name: "startTime", required: true, type: "time" },
    { name: "endTime", required: true, type: "time" },
    { name: "duration", required: false, type: "text" },
    { name: "ticketType", required: false, type: "text" },
    { name: "bookingReference", required: false, type: "text" },
    { name: "includes", required: false, type: "text" },
    { name: "meetingPoint", required: false, type: "text" },
  ],
  restaurant: [
    { name: "restaurantName", required: true, type: "text" },
    { name: "address", required: true, type: "text" },
    { name: "cuisine", required: true, type: "text" },
    { name: "dressCode", required: false, type: "text" },
    { name: "reservationReference", required: false, type: "text" },
    { name: "phone", required: false, type: "text" },
  ],
  transport: [
    { name: "company", required: true, type: "text" },
    { name: "pickupLocation", required: true, type: "text" },
    { name: "dropoffLocation", required: true, type: "text" },
    { name: "pickupTime", required: true, type: "text" },
    { name: "vehicleType", required: false, type: "text" },
    { name: "driverName", required: false, type: "text" },
    { name: "driverPhone", required: false, type: "text" },
    { name: "bookingReference", required: false, type: "text" },
  ],
  note: [],
};

const allTypes: ItemType[] = ["flight", "hotel", "activity", "restaurant", "transport", "note"];

function toExpectedShape(fields: readonly FieldDef[]): ExpectedField[] {
  return fields.map((field) => ({
    name: field.name,
    required: field.required ?? false,
    type: field.type,
    options: field.options,
  }));
}

describe("metadataFieldsByType field sets", () => {
  for (const type of allTypes) {
    it(`pins the ordered field names and required flags for ${type}`, () => {
      const expected = expectedFieldsByType[type];
      const actual = metadataFieldsByType[type];

      expect(actual.map((field) => field.name)).toEqual(expected.map((field) => field.name));
      expect(actual.map((field) => field.required ?? false)).toEqual(
        expected.map((field) => field.required),
      );
    });

    it(`pins the declared field type of every ${type} field`, () => {
      expect(metadataFieldsByType[type].map((field) => field.type)).toEqual(
        expectedFieldsByType[type].map((field) => field.type),
      );
    });
  }

  it("pins the exact hotel.boardBasis options", () => {
    const boardBasis = metadataFieldsByType.hotel.find((field) => field.name === "boardBasis");

    expect(boardBasis?.type).toBe("select");
    expect(boardBasis?.options).toEqual([
      { value: "Solo alojamiento", label: "Solo alojamiento" },
      { value: "Desayuno incluido", label: "Desayuno incluido" },
      { value: "Media pensión", label: "Media pensión" },
      { value: "Pensión completa", label: "Pensión completa" },
      { value: "Todo incluido", label: "Todo incluido" },
    ]);
  });

  it("keeps note with no metadata fields", () => {
    expect(metadataFieldsByType.note).toEqual([]);
  });

  it("matches the full pinned shape per type", () => {
    for (const type of allTypes) {
      expect(toExpectedShape(metadataFieldsByType[type])).toEqual(expectedFieldsByType[type]);
    }
  });
});

describe("appendSerializedMetadata serialization contract", () => {
  it("sets metadata to null and strips blank metadata_* keys", () => {
    const formData = new FormData();
    formData.set("metadata_airline", "");
    formData.set("metadata_flightNumber", "   ");

    appendSerializedMetadata(formData, "flight");

    expect(formData.get("metadata")).toBe("null");
    expect(formData.has("metadata_airline")).toBe(false);
    expect(formData.has("metadata_flightNumber")).toBe(false);
  });

  it("trims values and keeps only non-empty fields", () => {
    const formData = new FormData();
    formData.set("metadata_provider", "  Local Guide  ");
    formData.set("metadata_duration", "2h");
    formData.set("metadata_ticketType", "   ");

    appendSerializedMetadata(formData, "activity");

    expect(JSON.parse(String(formData.get("metadata")))).toEqual({
      provider: "Local Guide",
      duration: "2h",
    });
    expect(formData.has("metadata_provider")).toBe(false);
    expect(formData.has("metadata_duration")).toBe(false);
    expect(formData.has("metadata_ticketType")).toBe(false);
  });

  it("preserves a shared bookingReference across a type switch", () => {
    const formData = new FormData();
    formData.set("metadata_bookingReference", "HOTEL-STALE");

    appendSerializedMetadata(formData, "flight");

    expect(JSON.parse(String(formData.get("metadata")))).toMatchObject({
      bookingReference: "HOTEL-STALE",
    });
  });
});

describe("metadataDefaultValue", () => {
  const flightItem = {
    id: "item-1",
    tripDayId: "day-1",
    title: "Flight",
    sortOrder: 0,
    type: "flight",
    metadata: { airline: "AA", flightNumber: "1234" },
  } as Item;

  it("returns the string metadata value", () => {
    expect(metadataDefaultValue(flightItem, "airline")).toBe("AA");
  });

  it("returns undefined for a missing item or missing metadata", () => {
    expect(metadataDefaultValue(undefined, "airline")).toBeUndefined();
    expect(
      metadataDefaultValue({ ...flightItem, metadata: null } as Item, "airline"),
    ).toBeUndefined();
  });

  it("returns undefined for a non-string metadata value", () => {
    const itemWithNumericMetadata = {
      ...flightItem,
      metadata: { airline: 42 },
    } as unknown as Item;

    expect(metadataDefaultValue(itemWithNumericMetadata, "airline")).toBeUndefined();
  });
});

describe("schema/zod alignment", () => {
  const typedTypes: ItemType[] = ["flight", "hotel", "activity", "restaurant", "transport"];

  for (const type of typedTypes) {
    it(`accepts every ${type} UI field name in the matching zod schema`, () => {
      const allFields = Object.fromEntries(
        metadataFieldsByType[type].map((field) => [field.name, "value"]),
      );

      expect(() => validateItemMetadata(type, allFields)).not.toThrow();
    });
  }
});

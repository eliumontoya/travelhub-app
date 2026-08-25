import { describe, expect, it } from "vitest";
import { buildGoogleMapsUrl, resolveItemLocation, shouldAutofillSupplierLocation } from "@/lib/item-location";
import type { ItemWithSupplier } from "@/types";

const baseItem: ItemWithSupplier = {
  id: "item-1",
  tripDayId: "day-1",
  type: "hotel",
  title: "Hotel stay",
  sortOrder: 0,
  metadata: null,
};

describe("item location resolution", () => {
  it("uses item coordinates before linked supplier coordinates", () => {
    const location = resolveItemLocation({
      ...baseItem,
      location: "Manual location",
      lat: 19.1,
      lng: -99.1,
      supplier: { name: "Supplier", address: "Supplier address", lat: 20.2, lng: -100.2 },
    });

    expect(location).toEqual({
      label: "Manual location",
      address: "Manual location",
      lat: 19.1,
      lng: -99.1,
      source: "item",
    });
  });

  it("falls back to supplier coordinates when item location is empty", () => {
    const location = resolveItemLocation({
      ...baseItem,
      supplier: { name: "Supplier", address: "Supplier address", lat: 20.2, lng: -100.2 },
    });

    expect(location).toEqual({
      label: "Supplier address",
      address: "Supplier address",
      lat: 20.2,
      lng: -100.2,
      source: "supplier",
    });
  });

  it("builds Google Maps URLs without requiring an API key", () => {
    expect(buildGoogleMapsUrl({ address: "Av. Reforma 1, CDMX" })).toBe(
      "https://maps.google.com/?q=Av.%20Reforma%201%2C%20CDMX"
    );
    expect(buildGoogleMapsUrl({ lat: 19.1, lng: -99.1, address: "Ignored" })).toBe(
      "https://maps.google.com/?q=19.1%2C-99.1"
    );
  });

  it("allows supplier autofill only when item-specific location is empty", () => {
    expect(shouldAutofillSupplierLocation({ currentLocation: "", currentLat: undefined, currentLng: undefined })).toBe(true);
    expect(shouldAutofillSupplierLocation({ currentLocation: "Manual", currentLat: undefined, currentLng: undefined })).toBe(false);
    expect(shouldAutofillSupplierLocation({ currentLocation: "", currentLat: 19.1, currentLng: -99.1 })).toBe(false);
  });
});

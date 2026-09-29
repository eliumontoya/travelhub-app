import { describe, expect, it } from "vitest";
import {
  ITEM_SUPPLIER_TYPE,
  ItemSupplierCompatibilityError,
  getSupplierTypeForItem,
  isItemSupplierCompatibilityError,
  isSupplierTypeCompatible,
} from "@/lib/item-supplier-compatibility";

describe("item supplier compatibility", () => {
  it("maps every supplier-enabled item type to its supplier type", () => {
    expect(ITEM_SUPPLIER_TYPE).toEqual({
      hotel: "hotel",
      activity: "tour_operator",
      restaurant: "restaurant",
      transport: "transport",
    });
    expect(getSupplierTypeForItem("hotel")).toBe("hotel");
    expect(getSupplierTypeForItem("activity")).toBe("tour_operator");
    expect(getSupplierTypeForItem("restaurant")).toBe("restaurant");
    expect(getSupplierTypeForItem("transport")).toBe("transport");
  });

  it("leaves supplier-free item types unmapped and never matches other", () => {
    expect(getSupplierTypeForItem("flight")).toBeNull();
    expect(getSupplierTypeForItem("note")).toBeNull();
    expect(isSupplierTypeCompatible("flight", "hotel")).toBe(false);
    expect(isSupplierTypeCompatible("note", "tour_operator")).toBe(false);
    expect(isSupplierTypeCompatible("hotel", "other")).toBe(false);
  });

  it("recognizes only the exported compatibility error", () => {
    const error = new ItemSupplierCompatibilityError("Supplier does not match item type");

    expect(error.code).toBe("ITEM_SUPPLIER_INCOMPATIBLE");
    expect(isItemSupplierCompatibilityError(error)).toBe(true);
    expect(isItemSupplierCompatibilityError(new Error(error.message))).toBe(false);
    expect(isItemSupplierCompatibilityError({ code: error.code })).toBe(false);
  });
});

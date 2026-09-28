import { describe, expect, it } from "vitest";
import { getSupplierOptions } from "@/components/SupplierCombobox";
import type { Supplier } from "@/types";

const suppliers = [
  { id: "hotel", name: "Hotel Águila", type: "hotel" },
  { id: "hotel-two", name: "Hotel Centro", type: "hotel" },
  { id: "restaurant", name: "Hotel Restaurante", type: "restaurant" },
] as Supplier[];

describe("getSupplierOptions", () => {
  it("shows the full compatible catalog when an empty field receives focus", () => {
    expect(getSupplierOptions(suppliers, "hotel", "")).toEqual([suppliers[0], suppliers[1]]);
  });

  it("normalizes the query without exposing similar-name incompatible suppliers", () => {
    expect(getSupplierOptions(suppliers, "hotel", "aguila")).toEqual([suppliers[0]]);
    expect(getSupplierOptions(suppliers, "hotel", "hotel")).toEqual([suppliers[0], suppliers[1]]);
  });
});

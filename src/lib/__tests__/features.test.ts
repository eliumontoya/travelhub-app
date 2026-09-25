import { describe, it, expect } from "vitest";
import {
  AVAILABLE_FEATURES,
  FEATURE_DEFINITIONS,
  isFeature,
  filterFeatures,
} from "@/lib/auth/features";
import type { Feature } from "@/types";

const EXPECTED_FEATURES: Feature[] = [
  "trips",
  "clients",
  "suppliers",
  "travel-agents",
  "whatsapp",
  "settings",
];

describe("feature catalog", () => {
  it("exposes exactly the six features in the documented order", () => {
    expect(AVAILABLE_FEATURES).toEqual(EXPECTED_FEATURES);
    expect(AVAILABLE_FEATURES).toHaveLength(6);
  });

  it("maps every feature to a unique href and a Spanish label", () => {
    expect(FEATURE_DEFINITIONS).toHaveLength(6);

    const hrefByFeature = Object.fromEntries(
      FEATURE_DEFINITIONS.map((def) => [def.feature, { href: def.href, label: def.label }]),
    );

    expect(hrefByFeature.trips).toEqual({ href: "/dashboard/trips", label: "Viajes" });
    expect(hrefByFeature.clients).toEqual({ href: "/dashboard/clients", label: "Clientes" });
    expect(hrefByFeature.suppliers).toEqual({ href: "/dashboard/suppliers", label: "Proveedores" });
    expect(hrefByFeature["travel-agents"]).toEqual({
      href: "/dashboard/travel-agents",
      label: "Agentes",
    });
    expect(hrefByFeature.whatsapp).toEqual({ href: "/dashboard/wcc", label: "WhatsApp C.C." });
    expect(hrefByFeature.settings).toEqual({ href: "/dashboard/settings", label: "Ajustes" });

    // No two features share the same href (single source of truth).
    const hrefs = FEATURE_DEFINITIONS.map((def) => def.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("isFeature", () => {
  it("narrows every documented feature", () => {
    for (const feature of EXPECTED_FEATURES) {
      expect(isFeature(feature)).toBe(true);
    }
  });

  it("rejects unknown strings, empty strings, null, undefined, and non-strings", () => {
    expect(isFeature("bogus")).toBe(false);
    expect(isFeature("")).toBe(false);
    expect(isFeature(null)).toBe(false);
    expect(isFeature(undefined)).toBe(false);
    expect(isFeature(123)).toBe(false);
    expect(isFeature({})).toBe(false);
    expect(isFeature(["trips"])).toBe(false);
  });
});

describe("filterFeatures", () => {
  it("preserves the recognized features in their original order and drops unknowns", () => {
    expect(filterFeatures(["trips", "bogus", "clients", "another"])).toEqual(["trips", "clients"]);
  });

  it("returns an empty array when given an empty array", () => {
    expect(filterFeatures([])).toEqual([]);
  });

  it("returns an empty array for non-array inputs", () => {
    expect(filterFeatures(null)).toEqual([]);
    expect(filterFeatures(undefined)).toEqual([]);
    expect(filterFeatures("trips")).toEqual([]);
    expect(filterFeatures({ trips: true })).toEqual([]);
  });

  it("filters every recognized feature into a complete set", () => {
    expect(filterFeatures([...EXPECTED_FEATURES])).toEqual(EXPECTED_FEATURES);
  });
});

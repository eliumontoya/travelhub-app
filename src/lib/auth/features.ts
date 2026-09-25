import type { Feature } from "@/types";

/**
 * Single source of truth for every feature-aware surface (nav, route guards,
 * admin toggle UI). Order here is the order consumers render them in.
 */
export const AVAILABLE_FEATURES: Feature[] = [
  "trips",
  "clients",
  "suppliers",
  "travel-agents",
  "whatsapp",
  "settings",
];

export interface FeatureDefinition {
  feature: Feature;
  /** App Router path for the feature's main page. */
  href: string;
  /** Spanish UI label rendered in the dashboard nav. */
  label: string;
}

/**
 * Each feature's App Router entry point and label. `href` is the single
 * source consumers render — never hard-code feature paths elsewhere.
 */
export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  { feature: "trips", href: "/dashboard/trips", label: "Viajes" },
  { feature: "clients", href: "/dashboard/clients", label: "Clientes" },
  { feature: "suppliers", href: "/dashboard/suppliers", label: "Proveedores" },
  { feature: "travel-agents", href: "/dashboard/travel-agents", label: "Agentes" },
  { feature: "whatsapp", href: "/dashboard/wcc", label: "WhatsApp C.C." },
  { feature: "settings", href: "/dashboard/settings", label: "Ajustes" },
];

/** Type guard: narrows `unknown` to a catalog `Feature`. */
export function isFeature(value: unknown): value is Feature {
  return typeof value === "string" && (AVAILABLE_FEATURES as string[]).includes(value);
}

/**
 * Defensively filter an unknown array down to recognized `Feature` values.
 * - Returns `[]` for non-arrays.
 * - Preserves input order of recognized values; drops unknown strings silently
 *   so DB drift cannot leak into feature checks.
 */
export function filterFeatures(values: unknown): Feature[] {
  if (!Array.isArray(values)) return [];
  return values.filter(isFeature);
}

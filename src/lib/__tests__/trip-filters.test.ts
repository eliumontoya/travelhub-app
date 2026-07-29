import { describe, expect, it } from "vitest";
import { hasActiveTripFilters, tripMatchesFilters } from "@/lib/trip-filters";

const trip = {
  title: "Luna de miel en Italia",
  status: "published" as const,
  startDate: "2026-09-10",
  endDate: "2026-09-17",
  currency: "EUR" as const,
  instructions: "Lleven documento de identidad",
  clients: [
    {
      id: "c1",
      name: "Ana y Roberto Pérez",
      email: "ana@example.com",
      phone: "",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    },
  ],
  tags: [{ id: "tg1", name: "Luna de miel", createdAt: "2026-01-01T00:00:00Z" }],
};

describe("trip filters", () => {
  it("detecta filtros activos solo cuando hay valores reales", () => {
    expect(hasActiveTripFilters({ query: "" })).toBe(false);
    expect(hasActiveTripFilters({ tagIds: [] })).toBe(false);
    expect(hasActiveTripFilters({ query: "italia" })).toBe(true);
  });

  it("matchea filtros combinados con búsqueda accent-insensitive", () => {
    expect(
      tripMatchesFilters(trip, {
        query: "perez",
        status: ["published"],
        dateFrom: "2026-09-12",
        dateTo: "2026-09-20",
        clientIds: ["c1"],
        tagIds: ["tg1"],
        currency: "EUR",
      }),
    ).toBe(true);
  });

  it("rechaza viajes fuera del rango por traslape", () => {
    expect(tripMatchesFilters(trip, { dateFrom: "2026-10-01" })).toBe(false);
    expect(tripMatchesFilters(trip, { dateTo: "2026-09-01" })).toBe(false);
  });
});

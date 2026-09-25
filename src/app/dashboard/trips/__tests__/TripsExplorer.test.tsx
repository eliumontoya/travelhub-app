import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/app/dashboard/actions", () => ({
  bulkUpdateTripStatusAction: vi.fn(),
  moveTripStatusAction: vi.fn(),
}));

import { TripsExplorer } from "../TripsExplorer";

const trip = {
  id: "trip-1",
  title: "Viaje a Oaxaca",
  status: "published" as const,
  startDate: "2026-10-12",
  endDate: "2026-10-16",
  travelerCount: 2,
  currency: "MXN" as const,
  clients: [],
  tags: [],
};

describe("TripsExplorer", () => {
  it("keeps the trips summary, filter controls, navigation link, and list view semantics together", () => {
    const html = renderToStaticMarkup(
      <TripsExplorer
        trips={[trip]}
        clients={[]}
        tags={[]}
        initialFilters={{}}
        hasActiveFilters={false}
        totalCount={1}
      />,
    );

    expect(html).toContain("Resumen de viajes");
    expect(html).toContain("1 viaje encontrado");
    expect(html).toContain("Vista de lista");
    expect(html).toContain("Vista de tablero");
    expect(html).toContain('href="/dashboard/trips/trip-1"');
    expect(html).toContain('placeholder="Buscar por cliente o título de viaje…"');
    expect(html).toContain('aria-pressed="true"');
  });
});

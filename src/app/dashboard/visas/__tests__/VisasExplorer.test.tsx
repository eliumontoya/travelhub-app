import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import { VisasExplorer } from "../VisasExplorer";

const sampleClient = {
  id: "c1",
  name: "Ana Pérez",
  slug: "ana-perez",
  email: "ana@example.com",
  phone: "+52 55 0000 0000",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const sampleVisa = {
  id: "v1",
  clientId: "c1",
  country: "France",
  visaType: "Tourist",
  deadline: "2026-12-01",
  price: 150,
  status: "pending" as const,
  createdAt: "2026-09-30T10:00:00.000Z",
  updatedAt: "2026-09-30T10:00:00.000Z",
  clients: [sampleClient],
};

describe("VisasExplorer", () => {
  it("renders the visas summary, filter controls, status badges, and empty-state", () => {
    const html = renderToStaticMarkup(
      <VisasExplorer
        visas={[sampleVisa]}
        clients={[sampleClient]}
        initialFilters={{}}
        hasActiveFilters={false}
        totalCount={1}
      />,
    );

    expect(html).toContain("Resumen de visas");
    expect(html).toContain("1 visa encontrada");
    expect(html).toContain('href="/dashboard/visas/v1"');
    expect(html).toContain('data-testid="visa-status-pending"');
    expect(html).toContain("Pendiente");
    expect(html).toContain("France");
    expect(html).toContain("Tourist");
    expect(html).toContain("Ana Pérez");
    expect(html).toContain('href="/dashboard/visas/new"');
    // Filter controls present.
    expect(html).toContain('placeholder="Francia, Japón…"');
    expect(html).toContain('placeholder="País, tipo, notas…"');
    expect(html).toContain("En trámite");
    expect(html).toContain("Completada");
  });

  it("renders the empty-state copy when no visas match the filters", () => {
    const html = renderToStaticMarkup(
      <VisasExplorer
        visas={[]}
        clients={[]}
        initialFilters={{ status: ["completed"] }}
        hasActiveFilters
        totalCount={0}
      />,
    );

    expect(html).toContain("No hay visas que coincidan con los filtros actuales.");
    expect(html).toContain("+ Nueva visa");
  });

  it("renders the no-clients-assigned chip when a visa has no clients", () => {
    const orphanVisa = { ...sampleVisa, id: "v-orphan", clients: [] };
    const html = renderToStaticMarkup(
      <VisasExplorer
        visas={[orphanVisa]}
        clients={[sampleClient]}
        initialFilters={{}}
        hasActiveFilters={false}
        totalCount={1}
      />,
    );
    expect(html).toContain("Sin clientes asignados");
  });
});

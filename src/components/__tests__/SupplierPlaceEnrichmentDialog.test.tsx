import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SupplierPlaceEnrichmentDialog } from "@/components/SupplierPlaceEnrichmentDialog";
import type { Supplier } from "@/types";

const supplier: Supplier = {
  id: "supplier-1",
  name: "Hotel Manual",
  type: "hotel",
  address: undefined,
  notes: "Notas",
  tags: ["vip"],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("SupplierPlaceEnrichmentDialog", () => {
  it("shows current vs found values before confirming a candidate", () => {
    const html = renderToStaticMarkup(
      <SupplierPlaceEnrichmentDialog
        open
        supplier={supplier}
        initialCandidates={[{
          googlePlaceId: "ChIJ-confirmed",
          name: "Hotel Manual Reforma",
          address: "Paseo de la Reforma 1, CDMX",
          lat: 19.433,
          lng: -99.133,
        }]}
        initialSelectedPlaceId="ChIJ-confirmed"
        onClose={() => {}}
        onUpdated={() => {}}
      />
    );

    expect(html).toContain("Comparar antes de aplicar");
    expect(html).toContain("Actual");
    expect(html).toContain("Encontrado en Google");
    expect(html).toContain("Paseo de la Reforma 1, CDMX");
    expect(html).toContain("Confirmar y actualizar");
    expect(html).toContain("Cancelar");
  });

  it("keeps manual editing available when Google Places is not configured", () => {
    const html = renderToStaticMarkup(
      <SupplierPlaceEnrichmentDialog
        open
        supplier={supplier}
        googleMapsApiKey=""
        onClose={() => {}}
        onUpdated={() => {}}
      />
    );

    expect(html).toContain("Google Places no está configurado");
    expect(html).toContain("Puedes editar el proveedor manualmente");
    expect(html).not.toContain("Confirmar y actualizar");
  });
});

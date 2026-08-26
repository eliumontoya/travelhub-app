import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SupplierGooglePlaceBadge } from "@/components/SupplierGooglePlaceBadge";

describe("SupplierGooglePlaceBadge", () => {
  it("renders an accessible Google Maps badge when a place id exists", () => {
    const html = renderToStaticMarkup(<SupplierGooglePlaceBadge googlePlaceId="ChIJ-google" />);

    expect(html).not.toContain("Verificado con Google Maps");
    expect(html).toContain("aria-label=\"Proveedor encontrado con Google Maps\"");
    expect(html).toContain("title=\"ID de Google Maps: ChIJ-google\"");
  });

  it("renders nothing when place id is missing or blank", () => {
    expect(renderToStaticMarkup(<SupplierGooglePlaceBadge />)).toBe("");
    expect(renderToStaticMarkup(<SupplierGooglePlaceBadge googlePlaceId="   " />)).toBe("");
  });
});

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LocationActions } from "@/components/LocationMap";

describe("LocationActions", () => {
  it("renders a Google Maps link without requiring the embed API key", () => {
    const previous = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    const html = renderToStaticMarkup(
      <LocationActions address="Supplier address" label="Supplier address" />
    );

    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = previous;
    expect(html).toContain("Abrir en Google Maps");
    expect(html).toContain("https://maps.google.com/?q=Supplier%20address");
    expect(html).not.toContain("iframe");
  });
});

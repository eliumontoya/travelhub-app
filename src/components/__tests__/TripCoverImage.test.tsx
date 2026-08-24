import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TripCoverImage } from "@/components/TripCoverImage";

describe("TripCoverImage", () => {
  it("renders the cover image and remove button when a cover is set", () => {
    const html = renderToStaticMarkup(
      <TripCoverImage
        coverImageUrl="https://example.com/covers/trip.jpg"
        coversEnabled={true}
        onUpload={async () => {}}
        onRemove={async () => {}}
      />
    );

    expect(html).toContain("https://example.com/covers/trip.jpg");
    expect(html).toContain("Quitar");
    expect(html).toContain("Cambiar portada");
  });

  it("shows the upload prompt when no cover is set", () => {
    const html = renderToStaticMarkup(
      <TripCoverImage
        coverImageUrl={undefined}
        coversEnabled={true}
        onUpload={async () => {}}
        onRemove={async () => {}}
      />
    );

    expect(html).toContain("Sin imagen de portada");
    expect(html).toContain("Subir portada");
    expect(html).not.toContain("Quitar");
  });

  it("shows the Supabase configuration message when covers are disabled", () => {
    const html = renderToStaticMarkup(
      <TripCoverImage
        coverImageUrl={undefined}
        coversEnabled={false}
        onUpload={async () => {}}
        onRemove={async () => {}}
      />
    );

    expect(html).toContain("Configura Supabase para subir la portada");
    expect(html).not.toContain("type=\"file\"");
  });
});

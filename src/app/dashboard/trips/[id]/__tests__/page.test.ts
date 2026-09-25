import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

describe("TripEditorPage visual structure", () => {
  it("keeps configuration controls while presenting the itinerary in the corporate burgundy and gold system", () => {
    expect(page).toContain('bg-[#4a1834]');
    expect(page).toContain('border-[#f0bd79]/35');
    expect(page).toContain('bg-[#fdf7f3]');
    expect(page).toContain('mt-1 text-sm text-[#f7dfbc]');
    expect(page).toContain("TripPublishSubmitButton");
    expect(page).toContain("ServiceChecklistManager");
    expect(page).toContain("Las acciones de edición están bloqueadas mientras el viaje está publicado.");
  });
});

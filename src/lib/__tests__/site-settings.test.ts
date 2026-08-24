import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isSupabaseConfigured: () => false,
  createClient: vi.fn(),
}));

import { getSiteSettings, updateSiteSettings } from "@/lib/data";

describe("site settings (mock mode)", () => {
  it("persists and returns agencyName and logoUrl", async () => {
    await updateSiteSettings({
      agencyName: "Mi Agencia",
      logoUrl: "https://example.com/logo.png",
    });

    const settings = await getSiteSettings();
    expect(settings.agencyName).toBe("Mi Agencia");
    expect(settings.logoUrl).toBe("https://example.com/logo.png");
  });

  it("returns empty strings for unset branding fields", async () => {
    await updateSiteSettings({ agencyName: "", logoUrl: "" });
    const settings = await getSiteSettings();
    expect(settings.agencyName).toBe("");
    expect(settings.logoUrl).toBe("");
  });
});

import { test, expect } from "@playwright/test";
import { SEED } from "./helpers";

// `clients.cover_image_url` is publicly readable via
// supabase/migrations/20260930010000_clients_cover_image_public_read.sql,
// which grants anon a column-level select for the cover rendered on this page.
test.describe("Public client history view", () => {
  test("loads a seeded client history page anonymously", async ({ page }) => {
    const response = await page.goto(`/c/${SEED.clientHistorySlug}`);
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole("heading", { name: SEED.client.name })).toBeVisible();
    await expect(page.getByRole("link", { name: SEED.tripTitle })).toHaveAttribute(
      "href",
      `/t/${SEED.tripSlug}`,
    );
  });

  test("returns 404 for an unknown client slug", async ({ page }) => {
    const response = await page.goto("/c/cliente-inexistente-slug");
    expect(response?.status()).toBe(404);
  });
});

import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("muestra el dashboard con datos de prueba", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.locator("h1, h2, [data-testid='dashboard']")).toBeVisible();

    const hasTripsSection = await page.locator("text=Luna de miel").count();
    const hasClientsSection = await page.locator("text=Pérez").count();

    expect(hasTripsSection + hasClientsSection).toBeGreaterThanOrEqual(1);
  });

  test("navegación a clients funciona", async ({ page }) => {
    await page.goto("/dashboard");

    const clientLink = page.locator('a[href*="clients"]').first();
    if (await clientLink.count() > 0) {
      await clientLink.click();
      await expect(page).toHaveURL(/clients/);
    }
  });
});

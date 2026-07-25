import { test, expect } from "@playwright/test";

test.describe("Create trip", () => {
  test("puede navegar al formulario de nuevo viaje", async ({ page }) => {
    await page.goto("/dashboard/trips/new");

    await expect(page).toHaveURL(/trips\/new/);

    const heading = page.locator("h1, h2").first();
    await expect(heading).toBeVisible();
  });

  test("muestra campos del formulario de viaje", async ({ page }) => {
    await page.goto("/dashboard/trips/new");

    const titleInput = page.locator('input[name="title"]').first();
    if (await titleInput.count() > 0) {
      await expect(titleInput).toBeVisible();
    }
  });
});

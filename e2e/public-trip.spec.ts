import { test, expect } from "@playwright/test";

test.describe("Public trip view", () => {
  test("muestra el itinerario público del viaje publicado", async ({ page }) => {
    await page.goto("/t/italia-perez-2026");

    const title = page.locator("h1, h2").first();
    await expect(title).toBeVisible();

    await expect(page.locator("text=Luna de miel")).toBeVisible();
  });

  test("muestra días del viaje", async ({ page }) => {
    await page.goto("/t/italia-perez-2026");

    const dayElements = page.locator("[class*='day'], [data-testid*='day'], h3");
    const count = await dayElements.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("retorna 404 para slug inexistente", async ({ page }) => {
    const response = await page.goto("/t/viaje-inexistente-slug");
    expect(response?.status()).toBe(404);
  });

  test("muestra items del itinerario (vuelos, hoteles, etc)", async ({ page }) => {
    await page.goto("/t/italia-perez-2026");

    const hasItems =
      (await page.locator("text=✈️").count()) +
      (await page.locator("text=🏨").count()) +
      (await page.locator("text=🎟️").count());
    expect(hasItems).toBeGreaterThanOrEqual(1);
  });
});

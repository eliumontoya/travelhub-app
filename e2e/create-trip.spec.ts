import { test, expect } from "@playwright/test";

test.describe("Create trip", () => {
  test("puede navegar a la ruta de nuevo viaje", async ({ page }) => {
    const response = await page.goto("/dashboard/trips/new");
    expect(response?.status()).toBeLessThan(500);
  });
});

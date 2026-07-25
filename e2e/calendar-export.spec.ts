import { test, expect } from "@playwright/test";

test.describe("Calendar export", () => {
  test("carga la vista pública del viaje", async ({ page }) => {
    const response = await page.goto("/t/italia-perez-2026");
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState("networkidle");
  });
});

import { test, expect } from "@playwright/test";

test.describe("Public trip view", () => {
  test("carga la página del itinerario público", async ({ page }) => {
    const response = await page.goto("/t/italia-perez-2026");
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState("networkidle");
  });

  test("retorna respuesta para slug inexistente", async ({ page }) => {
    const response = await page.goto("/t/viaje-inexistente-slug");
    expect(response).not.toBeNull();
  });
});

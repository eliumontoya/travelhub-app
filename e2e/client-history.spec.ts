import { test, expect } from "@playwright/test";

test.describe("Public client history view", () => {
  test("loads a client history page anonymously", async ({ page }) => {
    const response = await page.goto("/c/ana-y-roberto-perez");
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState("networkidle");
  });

  test("returns a response for an unknown client slug", async ({ page }) => {
    const response = await page.goto("/c/cliente-inexistente-slug");
    expect(response).not.toBeNull();
  });
});

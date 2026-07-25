import { test, expect } from "@playwright/test";

test.describe("Create client", () => {
  test("puede navegar al dashboard de clientes", async ({ page }) => {
    const response = await page.goto("/dashboard");
    expect(response?.status()).toBeLessThan(500);
    await page.waitForLoadState("networkidle");
  });
});

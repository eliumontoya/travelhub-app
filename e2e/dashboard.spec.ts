import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("muestra el dashboard con contenido", async ({ page }) => {
    await page.goto("/dashboard");

    const body = page.locator("body");
    await expect(body).not.toBeEmpty();
    await page.waitForLoadState("networkidle");
  });
});

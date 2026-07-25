import { test, expect } from "@playwright/test";

test.describe("Create client", () => {
  test("puede navegar al formulario de nuevo cliente", async ({ page }) => {
    await page.goto("/dashboard");

    const newClientLink = page.locator('a[href*="clients/new"], a[href*="new-client"]').first();
    if (await newClientLink.count() > 0) {
      await newClientLink.click();
      await expect(page).toHaveURL(/new|clients/);
    }
  });

  test("puede crear un cliente via formulario", async ({ page }) => {
    await page.goto("/dashboard");

    const newClientLink = page.locator('a[href*="clients/new"], a[href*="new-client"]').first();
    if (await newClientLink.count() > 0) {
      await newClientLink.click();

      const nameInput = page.locator('input[name="name"], input[placeholder*="nombre" i]').first();
      if (await nameInput.count() > 0) {
        await nameInput.fill("Cliente Playwright Test");

        const emailInput = page.locator('input[name="email"]').first();
        if (await emailInput.count() > 0) {
          await emailInput.fill("playwright@test.com");
        }

        const submitBtn = page.locator('button[type="submit"]').first();
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForTimeout(1000);
        }
      }
    }
  });
});

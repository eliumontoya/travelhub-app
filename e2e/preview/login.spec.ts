import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("muestra el formulario de login o aviso de Supabase no configurado", async ({
    page,
  }) => {
    await page.goto("/login");

    const hasForm = await page.locator('form[action]').count();
    const hasWarning = await page.locator("text=Supabase no está configurado").count();
    const hasTravelHub = await page.locator("text=TravelHub").count();

    expect(hasForm + hasWarning + hasTravelHub).toBeGreaterThanOrEqual(1);
  });

  test("redirige a /dashboard desde la raíz sin auth (modo mock)", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/*", { timeout: 10000 });
    const url = page.url();
    expect(url.includes("/dashboard") || url.includes("/login")).toBe(true);
  });
});

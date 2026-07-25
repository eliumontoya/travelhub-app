import { test, expect } from "@playwright/test";

test.describe("Login flow", () => {
  test("muestra el formulario de login o aviso de Supabase no configurado", async ({
    page,
  }) => {
    await page.goto("/login");

    const title = page.locator("h1");
    await expect(title).toHaveText("TravelHub");

    const hasForm = await page.locator('form[action]').count();
    const hasWarning = await page.locator("text=Supabase no está configurado").count();

    expect(hasForm + hasWarning).toBeGreaterThanOrEqual(1);
  });

  test("redirige a /dashboard desde la raíz sin auth (modo mock)", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/dashboard/);
  });
});

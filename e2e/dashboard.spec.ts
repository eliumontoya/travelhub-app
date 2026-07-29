import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
  test("muestra el dashboard con contenido", async ({ page }) => {
    await page.goto("/dashboard");

    const body = page.locator("body");
    await expect(body).not.toBeEmpty();
    await page.waitForLoadState("networkidle");
  });

  test("sincroniza filtros con URL y limpia resultados", async ({ page }) => {
    await page.goto("/dashboard?page=2&clientsPage=2");
    if (await page.getByRole("button", { name: "Entrar" }).isVisible()) {
      test.skip(true, "Dashboard requiere sesión de Supabase en este entorno");
    }

    await page.getByLabel("Borrador").check();

    await expect(page).toHaveURL(/status=draft/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(/clientsPage=2/);
    await expect(page.getByRole("heading", { name: "Aventura en Cancún" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Luna de miel en Italia" })).toHaveCount(0);

    await page.getByRole("button", { name: "Limpiar filtros" }).click();

    await expect(page).not.toHaveURL(/status=draft/);
    await expect(page.getByRole("heading", { name: "Luna de miel en Italia" })).toBeVisible();
  });
});

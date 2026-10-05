import { expect, test } from "@playwright/test";

/**
 * Smoke tests for the deployed preview target (BASE_URL). They assert real,
 * session-independent behavior instead of "the page returned something":
 * the operator login form renders, and unauthenticated visitors are kept out
 * of the dashboard. Deeper flows are covered by the `local` project specs
 * against the seeded Supabase stack (issue #396 removed the idle `<500`
 * smoke specs).
 */
test.describe("Login flow", () => {
  test("muestra el formulario real de login de operadores", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("mantiene al visitante sin sesión fuera del dashboard", async ({ page }) => {
    await page.goto("/dashboard/trips/new");
    await expect(page).toHaveURL(/\/login/);
  });
});

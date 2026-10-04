import { test, expect } from "@playwright/test";
import { loginAsAdmin, loginAsAgent } from "./helpers";

const mainNav = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Navegación principal" });

test.describe("Role-based dashboard access", () => {
  test("admin reaches /dashboard and sees full nav", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(mainNav(page).getByRole("link", { name: "Agentes", exact: true })).toBeVisible();
    await expect(mainNav(page).getByRole("link", { name: "Ajustes", exact: true })).toBeVisible();
  });

  test("unauthenticated visitor is denied and redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page).toHaveURL(/redirectTo=%2Fdashboard/);
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("agent account sees reduced nav without admin-only items", async ({ page }) => {
    await loginAsAgent(page);
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(mainNav(page).getByRole("link", { name: "Viajes", exact: true })).toBeVisible();
    await expect(mainNav(page).getByRole("link", { name: "Clientes", exact: true })).toBeVisible();
    await expect(mainNav(page).getByRole("link", { name: "Agentes", exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole("link", { name: "Ajustes", exact: true })).toHaveCount(0);
    await expect(mainNav(page).getByRole("link", { name: "WhatsApp C.C.", exact: true })).toHaveCount(0);
  });
});

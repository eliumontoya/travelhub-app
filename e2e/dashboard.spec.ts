import { test, expect } from "@playwright/test";

async function skipIfLogin(page: import("@playwright/test").Page) {
  if (await page.getByRole("button", { name: "Entrar" }).isVisible()) {
    test.skip(true, "Dashboard requiere sesión de Supabase en este entorno");
  }
}

test.describe("Dashboard", () => {
  test("muestra navegación superior con rutas válidas", async ({ page }) => {
    await page.goto("/dashboard");
    await skipIfLogin(page);

    await expect(page.getByRole("navigation").getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Viajes", exact: true })).toHaveAttribute("href", "/dashboard/trips");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Clientes", exact: true })).toHaveAttribute("href", "/dashboard/clients");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Proveedores", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Ajustes", exact: true })).toBeVisible();
  });

  test("/dashboard es resumen ejecutivo sin listas ni filtros de gestión", async ({ page }) => {
    await page.goto("/dashboard?page=2&clientsPage=2&status=draft");
    await skipIfLogin(page);

    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByText("Resumen ejecutivo")).toBeVisible();
    await expect(page.getByText("Viajes creados por mes")).toBeVisible();
    await expect(page.getByText("Clientes por fuente de referido")).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toHaveCount(0);
    await expect(page.getByLabel("Borrador")).toHaveCount(0);
    await expect(page.getByText(/Página \d+ de \d+/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Mis viajes" })).toHaveCount(0);
  });

  test("/dashboard/trips muestra shell pendiente sin CRUD completo", async ({ page }) => {
    await page.goto("/dashboard/trips");
    await skipIfLogin(page);

    await expect(page.getByRole("heading", { name: "Viajes" })).toBeVisible();
    await expect(page.getByText("#124")).toBeVisible();
    await expect(page.getByRole("link", { name: /Nuevo viaje/ })).toHaveAttribute("href", "/dashboard/trips/new");
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toHaveCount(0);
    await expect(page.getByLabel("Borrador")).toHaveCount(0);
  });

  test("/dashboard/clients muestra shell pendiente sin listado completo", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await skipIfLogin(page);

    await expect(page.getByRole("heading", { name: "Clientes" })).toBeVisible();
    await expect(page.getByText("#125")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Clientes registrados" })).toHaveCount(0);
    await expect(page.getByText(/Página \d+ de \d+/)).toHaveCount(0);
  });

  test("/ resuelve a la experiencia Dashboard", async ({ page }) => {
    await page.goto("/");
    await skipIfLogin(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

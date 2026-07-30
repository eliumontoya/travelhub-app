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
    await expect(page.getByLabel("Borrador", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Página \d+ de \d+/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Mis viajes" })).toHaveCount(0);
  });

  test("/dashboard/trips muestra gestión completa de viajes sin listado de clientes", async ({ page }) => {
    await page.goto("/dashboard/trips");
    await skipIfLogin(page);

    await expect(page.getByRole("heading", { name: "Mis viajes" })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar por cliente o título de viaje…")).toBeVisible();
    await expect(page.getByLabel("Borrador", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista de lista" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista de tablero" })).toBeVisible();
    await expect(page.getByText(/Página \d+ de \d+/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Nuevo viaje/ })).toHaveAttribute("href", "/dashboard/trips/new");
    await expect(page.getByRole("link", { name: "Luna de miel en Italia" })).toHaveAttribute("href", "/dashboard/trips/t1");

    await page.getByLabel("Seleccionar Luna de miel en Italia").check();
    await expect(page.getByRole("button", { name: "Publicar seleccionados" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Archivar seleccionados" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Clientes registrados" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Exportar" })).toHaveCount(0);
    await expect(page.getByText("#125")).toHaveCount(0);
  });

  test("/dashboard/trips preserva filtros seguros en URL y resetea page al cambiar filtros", async ({ page }) => {
    await page.goto("/dashboard/trips?q=Cancún&status=draft&clientsPage=9&currency=BAD");
    await skipIfLogin(page);

    await expect(page.getByPlaceholder("Buscar por cliente o título de viaje…")).toHaveValue("Cancún");
    await expect(page.getByLabel("Borrador", { exact: true })).toBeChecked();
    await expect(page.locator("main").getByText("Aventura en Cancún")).toBeVisible();
    await expect(page.locator("main").getByText("Luna de miel en Italia")).toHaveCount(0);

    await page.getByPlaceholder("Buscar por cliente o título de viaje…").fill("Italia");
    await expect(page).toHaveURL(/q=Italia/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(/clientsPage=9/);
  });

  test("/dashboard/trips aplica filtros en tablero y conserva rutas de creación/edición", async ({ page }) => {
    await page.goto("/dashboard/trips?status=draft&page=-3&currency=MXN");
    await skipIfLogin(page);

    await expect(page.getByLabel("Borrador", { exact: true })).toBeChecked();
    await expect(page.getByRole("link", { name: /Nuevo viaje/ })).toHaveAttribute("href", "/dashboard/trips/new");
    await expect(page.locator("main").getByRole("link", { name: "Aventura en Cancún" })).toHaveAttribute("href", "/dashboard/trips/t2");

    await page.getByRole("button", { name: "Vista de tablero" }).click();
    await expect(page.locator("main").getByRole("link", { name: "Aventura en Cancún" })).toBeVisible();
    await expect(page.locator("main").getByText("Luna de miel en Italia")).toHaveCount(0);
    await expect(page.locator("main").getByText("Sin viajes")).toHaveCount(2);
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

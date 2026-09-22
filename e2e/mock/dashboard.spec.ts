import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

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

  test("/dashboard/clients muestra índice dedicado con clientes, etiquetas y exportación", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await skipIfLogin(page);

    await expect(page.getByText("#125")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Clientes registrados" })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar cliente por nombre…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana y Roberto Pérez/ })).toHaveAttribute("href", "/dashboard/clients/c1");
    await expect(page.getByRole("link", { name: /Familia Gómez/ })).toHaveAttribute("href", "/dashboard/clients/c2");
    await expect(page.getByText("ana.perez@example.com · +52 55 1234 5678")).toBeVisible();
    await expect(page.getByText("gomez.family@example.com · +52 33 9876 5432")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana y Roberto Pérez/ }).getByText("Luna de miel", { exact: true })).toBeVisible();
    await expect(page.getByText(/Página 1 de \d+/)).toBeVisible();
  });

  test("/dashboard/clients filtra por nombre en la página cargada", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await skipIfLogin(page);

    await page.getByPlaceholder("Buscar cliente por nombre…").fill("familia");
    await expect(page.getByRole("link", { name: /Familia Gómez/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana y Roberto Pérez/ })).toHaveCount(0);
    await expect(page.getByText("1 visible en esta página")).toBeVisible();

    await page.getByPlaceholder("Buscar cliente por nombre…").fill("sin resultados");
    await expect(page.getByText("Ningún cliente coincide con la búsqueda en esta página.")).toBeVisible();
  });

  test("/dashboard/clients conserva semántica de paginación y normaliza páginas inválidas", async ({ page }) => {
    await page.goto("/dashboard/clients?page=-3");
    await skipIfLogin(page);

    await expect(page.getByText("Página 1 de 2")).toBeVisible();
    await expect(page.getByText("← Anterior")).toBeVisible();
    await expect(page.getByRole("link", { name: "Siguiente →" })).toHaveAttribute("href", "/dashboard/clients?page=2");
  });

  test("/dashboard/clients cubre clientes de segunda página en runtime", async ({ page }) => {
    await page.goto("/dashboard/clients");
    await skipIfLogin(page);

    await expect(page.getByText("21 clientes registrados; 20 visibles en esta página.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana y Roberto Pérez/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Siguiente →" })).toHaveAttribute("href", "/dashboard/clients?page=2");

    await page.getByRole("link", { name: "Siguiente →" }).click();
    await expect(page).toHaveURL(/\/dashboard\/clients\?page=2$/);
    await expect(page.getByText("Página 2 de 2")).toBeVisible();
    await expect(page.getByRole("link", { name: "← Anterior" })).toHaveAttribute("href", "/dashboard/clients");
    await expect(page.getByRole("link", { name: "Siguiente →" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Cliente Demo 21/ })).toHaveAttribute("href", "/dashboard/clients/c21");
    await expect(page.getByText("cliente21@example.com · +52 55 0000 0021")).toBeVisible();
    await expect(page.getByRole("link", { name: /Ana y Roberto Pérez/ })).toHaveCount(0);
  });

  test("/dashboard/clients descarga CSV con campos y alcance de página filtrada", async ({ page }) => {
    await page.goto("/dashboard/clients?page=2");
    await skipIfLogin(page);

    await expect(page.getByText("21 clientes registrados; 1 visible en esta página.")).toBeVisible();
    await page.getByPlaceholder("Buscar cliente por nombre…").fill("Demo 21");
    await expect(page.getByRole("link", { name: /Cliente Demo 21/ })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();

    const csv = await readFile(path!, "utf8");
    const rows = csv.split("\r\n");
    expect(rows).toEqual([
      "Nombre,Email,Teléfono,Notas,Creado",
      "Cliente Demo 21,cliente21@example.com,+52 55 0000 0021,Cliente demo para segunda página.,2026-06-29T10:00:00Z",
    ]);
    expect(csv).not.toContain("Ana y Roberto Pérez");
    expect(csv).not.toContain("Cliente Demo 20");
  });

  test("rutas adyacentes de clientes y públicas conservan su comportamiento", async ({ page }) => {
    await page.goto("/dashboard/clients/c1");
    await skipIfLogin(page);
    await expect(page.getByRole("heading", { name: "Ana y Roberto Pérez" })).toBeVisible();

    await page.goto("/t/italia-perez-2026");
    await expect(page.getByRole("heading", { name: "Luna de miel en Italia" })).toBeVisible();
  });

  test("/ resuelve a la experiencia Dashboard", async ({ page }) => {
    await page.goto("/");
    await skipIfLogin(page);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  });
});

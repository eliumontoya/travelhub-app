import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { SEED, loginAsAdmin } from "./helpers";

test.describe("Dashboard", () => {
  test("muestra navegación superior con rutas válidas", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard");

    const nav = page.getByRole("navigation", { name: "Navegación principal" });
    await expect(nav.getByRole("link", { name: "Inicio", exact: true })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    await expect(nav.getByRole("link", { name: "Viajes", exact: true })).toHaveAttribute(
      "href",
      "/dashboard/trips",
    );
    await expect(nav.getByRole("link", { name: "Clientes", exact: true })).toHaveAttribute(
      "href",
      "/dashboard/clients",
    );
    await expect(nav.getByRole("link", { name: "Proveedores", exact: true })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Ajustes", exact: true })).toBeVisible();
  });

  test("/dashboard es resumen ejecutivo sin listas ni filtros de gestión", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard?page=2&clientsPage=2&status=draft");

    await expect(page.getByRole("heading", { name: "Buenos días" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Viajes en curso" })).toBeVisible();
    await expect(page.getByText("Viajes creados por mes")).toBeVisible();
    await expect(page.getByText("Clientes por fuente de referido")).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpiar filtros" })).toHaveCount(0);
    await expect(page.getByLabel("Borrador", { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Página \d+ de \d+/)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Mis viajes" })).toHaveCount(0);
  });

  test("/dashboard/trips muestra gestión completa de viajes sin listado de clientes", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/trips");

    await expect(page.getByRole("heading", { name: "Mis viajes" })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar por cliente o título de viaje…")).toBeVisible();
    await expect(page.getByLabel("Borrador", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista de lista" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Vista de tablero" })).toBeVisible();
    await expect(page.getByText("Página 1 de 1")).toBeVisible();
    await expect(page.getByRole("link", { name: /Nuevo viaje/ })).toHaveAttribute(
      "href",
      "/dashboard/trips/new",
    );
    await expect(page.getByRole("link", { name: SEED.tripTitle })).toHaveAttribute(
      "href",
      `/dashboard/trips/${SEED.tripId}`,
    );

    await page.getByLabel(`Seleccionar ${SEED.tripTitle}`).check();
    await expect(page.getByRole("button", { name: "Publicar seleccionados" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Archivar seleccionados" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Clientes registrados" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Exportar CSV" })).toHaveCount(0);
  });

  test("/dashboard/trips preserva filtros seguros en URL y resetea page al cambiar filtros", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/trips?q=Cancún&status=draft&clientsPage=9&currency=BAD");

    await expect(page.getByPlaceholder("Buscar por cliente o título de viaje…")).toHaveValue(
      "Cancún",
    );
    await expect(page.getByLabel("Borrador", { exact: true })).toBeChecked();
    await expect(page.locator("main").getByText(SEED.draftTripTitle)).toBeVisible();
    await expect(page.locator("main").getByText(SEED.tripTitle)).toHaveCount(0);

    await page.getByPlaceholder("Buscar por cliente o título de viaje…").fill("Italia");
    await expect(page).toHaveURL(/q=Italia/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect(page).not.toHaveURL(/clientsPage=9/);
  });

  test("/dashboard/trips aplica filtros en tablero y conserva rutas de creación/edición", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/trips?status=draft&page=-3&currency=MXN");

    await expect(page.getByLabel("Borrador", { exact: true })).toBeChecked();
    await expect(page.getByRole("link", { name: /Nuevo viaje/ })).toHaveAttribute(
      "href",
      "/dashboard/trips/new",
    );
    await expect(page.locator("main").getByRole("link", { name: SEED.draftTripTitle })).toHaveAttribute(
      "href",
      `/dashboard/trips/${SEED.draftTripId}`,
    );

    await page.getByRole("button", { name: "Vista de tablero" }).click();
    await expect(page.locator("main").getByRole("link", { name: SEED.draftTripTitle })).toBeVisible();
    await expect(page.locator("main").getByText(SEED.tripTitle)).toHaveCount(0);
    await expect(page.locator("main").getByText("Sin viajes")).toHaveCount(2);
  });

  test("/dashboard/clients muestra índice dedicado con clientes, etiquetas y exportación", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/clients");

    await expect(page.getByRole("heading", { name: "Clientes registrados" })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar cliente por nombre…")).toBeVisible();
    await expect(page.getByRole("button", { name: "Exportar CSV" })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(SEED.client.name) })).toHaveAttribute(
      "href",
      `/dashboard/clients/${SEED.clientId}`,
    );
    await expect(page.getByRole("link", { name: new RegExp(SEED.secondClient.name) })).toHaveAttribute(
      "href",
      `/dashboard/clients/${SEED.secondClientId}`,
    );
    await expect(page.getByText("ana.perez@example.com · +52 55 1234 5678")).toBeVisible();
    await expect(page.getByText("gomez.family@example.com · +52 33 9876 5432")).toBeVisible();
    await expect(
      page.getByRole("link", { name: new RegExp(SEED.client.name) }).getByText("Luna de miel", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Página 1 de 1")).toBeVisible();
  });

  test("/dashboard/clients filtra por nombre en la página cargada", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/clients");

    await page.getByPlaceholder("Buscar cliente por nombre…").fill("familia");
    await expect(page.getByRole("link", { name: new RegExp(SEED.secondClient.name) })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(SEED.client.name) })).toHaveCount(0);
    await expect(page.getByText("1 visible en esta página")).toBeVisible();

    await page.getByPlaceholder("Buscar cliente por nombre…").fill("sin resultados");
    await expect(
      page.getByText("Ningún cliente coincide con la búsqueda en esta página."),
    ).toBeVisible();
  });

  test("/dashboard/clients normaliza páginas inválidas a la primera página", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/clients?page=-3");

    await expect(page.getByText("Página 1 de 1")).toBeVisible();
    await expect(page.getByRole("link", { name: "← Anterior" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Siguiente →" })).toHaveCount(0);
    await expect(page.getByText("← Anterior")).toBeVisible();
    await expect(page.getByText("Siguiente →")).toBeVisible();
  });

  test("/dashboard/clients descarga CSV con campos y alcance de la página filtrada", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await page.goto("/dashboard/clients");

    await page.getByPlaceholder("Buscar cliente por nombre…").fill("Ana");
    await expect(page.getByRole("link", { name: new RegExp(SEED.client.name) })).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Exportar CSV" }).click();
    const download = await downloadPromise;
    const path = await download.path();
    expect(path).not.toBeNull();

    const csv = await readFile(path!, "utf8");
    const [header, firstRow] = csv.split("\r\n");
    expect(header).toBe("Nombre,Email,Teléfono,Notas,Creado");
    expect(firstRow).toContain(
      `${SEED.client.name},ana.perez@example.com,+52 55 1234 5678,`,
    );
    expect(csv).toContain("Luna de miel, prefieren hoteles boutique.");
    expect(csv).not.toContain(SEED.secondClient.name);
  });

  test("rutas adyacentes de clientes y públicas conservan su comportamiento", async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`/dashboard/clients/${SEED.clientId}`);
    await expect(page.getByRole("heading", { name: SEED.client.name })).toBeVisible();

    await page.goto(`/t/${SEED.tripSlug}`);
    await expect(page.getByRole("heading", { name: SEED.tripTitle })).toBeVisible();
  });

  test("/ renderiza la landing pública con split agente/viajero", async ({ page }) => {
    await page.goto("/");

    await expect(page).not.toHaveURL(/dashboard/);
    await expect(page.getByRole("heading", { name: "Planifica. Gestiona. Viaja." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Acceder Agentes" })).toHaveAttribute("href", "/login");
    await expect(page.getByRole("link", { name: "Ingresar Viajeros" })).toHaveAttribute(
      "href",
      "/client/login",
    );
  });
});

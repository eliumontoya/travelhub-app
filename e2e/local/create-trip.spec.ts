import { expect, test } from "@playwright/test";
import { SEED, ensureTripStatus, loginAsAgent, signInClient } from "./helpers";

/**
 * Core use case (issue #396): an agent creates a trip through the dashboard
 * form, builds its itinerary (day + flight/note items), publishes it, and the
 * assigned traveler can then see it. Uses only seeded state (client c1) plus
 * a fresh client created through the form's "O cliente nuevo" fields.
 *
 * The created trip is reverted to draft at the end so the public site and the
 * client portal return to the seed state for later runs.
 */

const tripTitle = `E2E Roadtrip ${Date.now().toString(36)}`;

test("rejects a trip without at least one client", async ({ page }) => {
  await loginAsAgent(page);
  await page.goto("/dashboard/trips/new");
  await page.locator('input[name="title"]').fill(tripTitle);
  await page.getByRole("button", { name: "Crear viaje" }).click();
  // Client-side guard (MinClientsGuard) blocks the submit before the server;
  // the URL stays on the form.
  await expect(
    page.getByText("Selecciona al menos un cliente o creá uno nuevo"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/trips\/new$/);
});

test("creates a trip, builds its itinerary, publishes it and the traveler sees it", async ({
  page,
}) => {
  await loginAsAgent(page);

  // Create the trip through the real form: seeded client + brand-new client.
  await page.goto("/dashboard/trips/new");
  await page.locator('input[name="title"]').fill(tripTitle);
  await page.locator('input[name="startDate"]').fill("2026-03-10");
  await page.locator('input[name="endDate"]').fill("2026-03-12");
  await page.locator('input[name="travelerCount"]').fill("3");
  await page.locator('select[name="currency"]').selectOption("EUR");

  const clientSearch = page.getByPlaceholder("Buscar cliente por nombre…");
  await clientSearch.fill("Ana y Roberto");
  await page.getByRole("button", { name: SEED.client.name }).click();
  await expect(page.locator('input[type="hidden"][name="clientIds"]')).toHaveCount(1);

  await page.locator('input[name="newClientName"]').fill(`Cliente E2E ${tripTitle}`);
  await page.locator('input[name="newClientEmail"]').fill("e2e-new-client@example.com");

  await page.getByRole("button", { name: "Crear viaje" }).click();

  // The action redirects to the trip editor.
  await expect(page).toHaveURL(/\/dashboard\/trips\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: tripTitle, exact: true })).toBeVisible();
  const tripUrl = page.url();
  const tripId = tripUrl.split("/").pop()!;

  // Build the itinerary: one day, then a flight and a note on it.
  await page.getByRole("button", { name: "+ Agregar día" }).first().click();
  const dayDialog = page.locator("dialog[open]");
  await dayDialog.locator('input[name="date"]').fill("2026-03-10");
  await dayDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await page.getByRole("button", { name: "+ Agregar item a este día" }).first().click();
  const itemDialog = page.locator("dialog[open]").filter({ hasText: "Agregar item" });
  await itemDialog.locator('select[name="type"]:not(#supplier-type)').selectOption("flight");
  await itemDialog.locator('input[name="title"]').fill("Vuelo E2E AM 34");
  await itemDialog.locator('input[name="metadata_airline"]').fill("Aeroméxico");
  await itemDialog.locator('input[name="metadata_flightNumber"]').fill("AM 34");
  await itemDialog.locator('input[name="metadata_departureAirport"]').fill("MEX");
  await itemDialog.locator('input[name="metadata_arrivalAirport"]').fill("MAD");
  await itemDialog.locator('input[name="metadata_departureTime"]').fill("09:30");
  await itemDialog.locator('input[name="metadata_arrivalTime"]').fill("15:45");
  await itemDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  await page.getByRole("button", { name: "+ Agregar item a este día" }).first().click();
  const noteDialog = page.locator("dialog[open]").filter({ hasText: "Agregar item" });
  await noteDialog.locator('select[name="type"]:not(#supplier-type)').selectOption("note");
  await noteDialog.locator('input[name="title"]').fill("Nota E2E: chequear maletas");
  await noteDialog.getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);

  // Items persist across a reload.
  await page.reload();
  await expect(page.getByText("Vuelo E2E AM 34").first()).toBeVisible();
  await expect(page.getByText("Nota E2E: chequear maletas").first()).toBeVisible();

  // Publish through the real toggle (idempotent helper that clicks it and
  // waits for the badge) and derive the public URL from the preview link.
  await ensureTripStatus(page, tripId, "published");
  const previewHref = await page
    .getByRole("link", { name: "Vista previa", exact: true })
    .getAttribute("href");
  const publicPath = new URL(previewHref!, "http://localhost:3000").pathname;
  expect(publicPath).toMatch(/^\/t\/.+$/);

  // Anonymous visitors now see the itinerary.
  await page.context().clearCookies();
  await page.goto(publicPath);
  await expect(page.getByRole("heading", { name: tripTitle, exact: true })).toBeVisible();
  await expect(page.getByText("Vuelo E2E AM 34").first()).toBeVisible();

  // The assigned traveler sees the published trip in the portal.
  await signInClient(page);
  await page.goto("/client");
  await expect(page.getByText(tripTitle)).toBeVisible();

  // Leave the seed state clean: back to draft keeps the trip out of /t.
  await loginAsAgent(page);
  await ensureTripStatus(page, tripId, "draft");
  await page.context().clearCookies();
  await page.goto(publicPath);
  await expect(page.getByRole("heading", { name: "Itinerario no disponible", exact: true })).toBeVisible();
});

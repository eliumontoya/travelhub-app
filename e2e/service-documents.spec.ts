import { expect, test } from "@playwright/test";

async function skipIfLogin(page: import("@playwright/test").Page) {
  if (await page.getByRole("button", { name: "Entrar" }).isVisible()) {
    test.skip(true, "Dashboard requires a Supabase session in this environment");
  }
}

test.describe.configure({ mode: "serial" });

test.describe("Service documents", () => {
  test("loads traveler detail lazily and keeps published review and bulk assignment counts current", async ({
    page,
  }) => {
    await page.goto("/dashboard/trips/t1");
    await skipIfLogin(page);

    const documentsButton = page.getByRole("button", { name: "Documentos" });
    const travelerSummary = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "Ana y Roberto Pérez" }) });
    await expect(travelerSummary).toContainText("1/3 procesados");
    await expect(travelerSummary).toContainText("1 pendiente de revisión");
    await expect(page.getByText("Seguro de viaje")).toHaveCount(0);

    await documentsButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Ana y Roberto Pérez" })).toBeVisible();
    await expect(dialog.getByText("Seguro de viaje")).toBeVisible();
    await expect(dialog.getByLabel("Contenido del checklist")).toHaveCSS("overflow-y", "auto");

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(documentsButton).toBeFocused();

    await documentsButton.click();
    await dialog.getByRole("button", { name: "Marcar procesado" }).click();
    await expect(travelerSummary).toContainText("2/3 procesados", { timeout: 10_000 });
    await expect(travelerSummary).not.toContainText("pendiente de revisión", { timeout: 10_000 });

    await dialog.getByRole("button", { name: "Cerrar" }).click();
    await page.getByLabel("Asignar a todos los viajeros").fill("Copia de pasaporte");
    await page.getByRole("button", { name: "Asignar documento" }).click();
    await expect(travelerSummary).toContainText("2/4 procesados", { timeout: 10_000 });
  });

  test("does not expose service-document mutations for an archived trip", async ({ page }) => {
    const archivedTripId = process.env.E2E_ARCHIVED_SERVICE_DOCUMENTS_TRIP_ID;
    test.skip(!archivedTripId, "Requires an archived trip fixture backed by a persistent database");

    await page.goto(`/dashboard/trips/${archivedTripId}`);
    await skipIfLogin(page);
    await expect(page.getByLabel("Asignar a todos los viajeros")).toHaveCount(0);
    const documentsButton = page.getByRole("button", { name: "Documentos" });
    await documentsButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Marcar procesado" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Agregar" })).toHaveCount(0);
  });
});

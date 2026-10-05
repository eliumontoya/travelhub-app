import { expect, test } from "@playwright/test";
import { SEED, deleteRowsByEq, ensureTripStatus, loginAsAdmin, patchRowsByEq } from "./helpers";

// Deterministic seed ids (see `supabase/seed.sql`). The service belongs to the
// seeded trip/client; the checklist item is the `Seguro de viaje` upload the
// spec marks as reviewed and must restore to its seed status.
const SEED_CHECKLIST_SEGURO_ID = "5c220000-0000-4000-8000-000000000002";
const REQUESTED_DOCUMENT_LABEL = "Copia de pasaporte";

test.describe.configure({ mode: "serial" });

test.describe("Service documents", () => {
  test.beforeEach(async ({ request }) => {
    // Remove the requested document a previous run added; its upload, if any,
    // falls with `on delete cascade`.
    await deleteRowsByEq(request, "service_checklist_items", "label", REQUESTED_DOCUMENT_LABEL);
    // "Marcar como revisado" is not reversible from the UI, so restore the
    // seed status directly to keep `1/3 revisados` / `1 pendiente` stable.
    await patchRowsByEq(request, "service_uploads", "checklist_item_id", SEED_CHECKLIST_SEGURO_ID, {
      status: "uploaded",
    });
  });

  test("loads traveler detail lazily and keeps review and checklist counts current", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    // The seeded trip is published; the checklist stays actionable for it.
    await page.goto(`/dashboard/trips/${SEED.tripId}`);

    const documentsButton = page.getByRole("button", { name: "Documentos" });
    const travelerSummary = page
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: SEED.client.name }) });
    await expect(travelerSummary).toContainText("1/3 revisados");
    await expect(travelerSummary).toContainText("1 pendiente de revisión");
    await expect(page.getByText("Seguro de viaje")).toHaveCount(0);

    await documentsButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: SEED.client.name })).toBeVisible();
    await expect(dialog.getByText("Seguro de viaje")).toBeVisible();
    await expect(dialog.getByLabel("Contenido del checklist")).toHaveCSS("overflow-y", "auto");

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(documentsButton).toBeFocused();

    await documentsButton.click();
    await dialog.getByRole("button", { name: "Marcar como revisado" }).click();
    await expect(travelerSummary).toContainText("2/3 revisados", { timeout: 10_000 });
    await expect(travelerSummary).not.toContainText("pendiente de revisión", { timeout: 10_000 });

    // Adding a new requested document keeps the summary total current.
    await dialog.getByPlaceholder("Nuevo documento solicitado").fill("Copia de pasaporte");
    await dialog.getByRole("button", { name: "Agregar", exact: true }).click();
    await expect(travelerSummary).toContainText("2/4 revisados", { timeout: 10_000 });
  });

  test("does not expose service-document mutations for an archived trip", async ({ page }) => {
    await loginAsAdmin(page);

    // Archive the seeded trip through the real bulk action.
    await page.goto("/dashboard/trips");
    await page.getByLabel(`Seleccionar ${SEED.tripTitle}`).check();
    await page.getByRole("button", { name: "Archivar seleccionados" }).click();
    await expect(page.locator("main").getByText("Archivado").first()).toBeVisible();

    await page.goto(`/dashboard/trips/${SEED.tripId}`);
    const documentsButton = page.getByRole("button", { name: "Documentos" });
    await documentsButton.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Marcar como revisado" })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Agregar", exact: true })).toHaveCount(0);

    // Restore the seeded state so downstream specs still see a published trip.
    await ensureTripStatus(page, SEED.tripId, "published");
  });
});

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import {
  SEED,
  deleteRowsByEq,
  deleteRowsByNameLike,
  ensureTripStatus,
  loginAsAdmin,
  setClientPin,
  signInClient,
  uniqueName,
} from "./helpers";

const daySelector = `#day-${SEED.firstDayId}`;

declare global {
  interface Window {
    __travelhubCalendarDownloads: Array<{ download: string; href: string }>;
  }
}

/**
 * Item card that owns `title`. Anchoring row-scoped locators on the card keeps
 * them independent from the number of residual rows around it (issue #406).
 */
function activityCard(page: Page, title: string) {
  return page
    .getByText(title, { exact: true })
    .locator("xpath=ancestor::div[contains(@class, 'rounded-[1rem]')][1]");
}

/**
 * Expand the create-activity form for the seed day and return the panel that
 * contains only that form. Scoping to the panel (not the whole day) keeps its
 * `input[name=title]` from colliding with the `details input[name=title]` of
 * activities already on that day.
 */
async function expandActivityForm(page: Page) {
  const day = page.locator(daySelector);
  await day.getByRole("button", { name: "+ Agregar actividad a este día" }).click();
  return day
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Agregar una actividad" }) })
    .first();
}

/** Delete every activity this spec created, scoped to the seed day. */
async function deleteCreatedActivities(request: APIRequestContext): Promise<void> {
  await deleteRowsByNameLike(request, "items", "title", "E2E *", {
    trip_day_id: `eq.${SEED.firstDayId}`,
  });
}

/**
 * Restore the seed client assignment for the seeded trip. Test 3 temporarily
 * assigns `SEED.secondClient`, which auto-creates a service row; without this
 * reset a repeated run finds a second traveler card (breaking
 * `service-documents`) and the "Gestionar clientes" search hides the client
 * because it is already assigned.
 */
async function resetSeedTripAssignment(request: APIRequestContext): Promise<void> {
  await deleteRowsByEq(request, "services", "client_id", SEED.secondClientId, {
    trip_id: `eq.${SEED.tripId}`,
  });
  await deleteRowsByEq(request, "trip_clients", "client_id", SEED.secondClientId, {
    trip_id: `eq.${SEED.tripId}`,
  });
}

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({ request }) => {
  await deleteCreatedActivities(request);
  await resetSeedTripAssignment(request);
});

test.afterAll(async ({ request }) => {
  await deleteCreatedActivities(request);
  await resetSeedTripAssignment(request);
});

test.describe("Traveler-created activities", () => {
  test("keeps anonymous itinerary viewing, calendar export, and the agent lock available", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await ensureTripStatus(page, SEED.tripId, "published");
    await page.context().clearCookies();

    await page.goto(`/t/${SEED.tripSlug}`);
    await expect(page.getByRole("heading", { name: SEED.tripTitle })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agregar una actividad" })).toHaveCount(0);

    await page.evaluate(() => {
      window.__travelhubCalendarDownloads = [];
      const originalClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function patchedCalendarDownloadClick() {
        window.__travelhubCalendarDownloads.push({ download: this.download, href: this.href });
        HTMLAnchorElement.prototype.click = originalClick;
      };
    });
    await page.getByRole("button", { name: /Agregar viaje completo a mi calendario/ }).click();
    await expect.poll(() => page.evaluate(() => window.__travelhubCalendarDownloads)).toEqual([
      expect.objectContaining({
        download: `${SEED.tripSlug}.ics`,
        href: expect.stringMatching(/^blob:/),
      }),
    ]);

    await loginAsAdmin(page);
    await page.goto(`/dashboard/trips/${SEED.tripId}`);
    await expect(
      page.getByText(
        "Viaje publicado bloqueado. Pásalo a borrador para editar días, itinerario o acciones.",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Las acciones de edición están bloqueadas mientras el viaje está publicado."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Agregar item a este día" })).toHaveCount(0);
  });

  test("lets an assigned traveler add on desktop then edit and delete on mobile", async ({
    page,
    browser,
  }) => {
    const title = uniqueName("E2E paseo por Trastevere");
    const updatedTitle = uniqueName("E2E cena en Trastevere");

    await signInClient(page);
    await page.goto(`/t/${SEED.tripSlug}`);

    const addForm = await expandActivityForm(page);
    await addForm.locator("input[name=title]").fill(title);
    await addForm.locator("input[name=startTime]").fill("19:30");
    await addForm.locator("input[name=location]").fill("Trastevere");
    await addForm.locator("textarea[name=notes]").fill("Mesa junto a la plaza");
    await addForm.getByRole("button", { name: "Agregar actividad", exact: true }).click();
    await expect(page.getByText("Actividad agregada.")).toBeVisible();

    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(/19:30|7:30/)).toBeVisible();
    await expect(page.getByText("Trastevere", { exact: true }).first()).toBeVisible();
    const card = activityCard(page, title);
    await card.getByText("Ver más detalles").click();
    await expect(card.locator("div").filter({ hasText: /^Mesa junto a la plaza$/ }).first()).toBeVisible();

    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobile = await mobileContext.newPage();
    try {
      await signInClient(mobile);
      await mobile.goto(`/t/${SEED.tripSlug}`);
      await expect(mobile.getByText(title, { exact: true })).toBeVisible();

      const mobileCard = activityCard(mobile, title);
      await mobileCard.getByText("Editar actividad").click();
      await mobileCard.locator("details input[name=title]").fill(updatedTitle);
      // The stored Postgres `time` renders as HH:MM:SS, which the activity
      // schema rejects on update; set a valid HH:MM before saving.
      await mobileCard.locator("details input[name=startTime]").fill("20:00");
      await mobileCard.getByRole("button", { name: "Guardar cambios" }).click();
      await expect(mobile.getByText("Actividad actualizada.")).toBeVisible();
      const updatedCard = activityCard(mobile, updatedTitle);
      await expect(updatedCard.getByText(updatedTitle, { exact: true })).toBeVisible();

      await updatedCard.getByRole("button", { name: "Eliminar" }).click();
      await expect(mobile.getByText(updatedTitle, { exact: true })).toHaveCount(0);
    } finally {
      await mobileContext.close();
    }
  });

  test("hides another traveler's controls while retaining assigned creation controls", async ({
    page,
  }) => {
    const title = uniqueName("E2E actividad de Ana");

    // Admin setup: seed a PIN for c2 and assign c2 to the published trip.
    await loginAsAdmin(page);
    await ensureTripStatus(page, SEED.tripId, "draft");
    await setClientPin(page, SEED.secondClientId);
    await page.goto(`/dashboard/trips/${SEED.tripId}`);
    await page.getByRole("button", { name: "Gestionar clientes" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Buscar cliente por nombre…").fill(SEED.secondClient.name);
    await dialog.getByRole("button", { name: SEED.secondClient.name }).click();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog).toHaveCount(0);
    await ensureTripStatus(page, SEED.tripId, "published");

    // The assigned traveler c1 adds its own activity.
    await page.context().clearCookies();
    await signInClient(page);
    await page.goto(`/t/${SEED.tripSlug}`);
    const addForm = await expandActivityForm(page);
    await addForm.locator("input[name=title]").fill(title);
    await addForm.getByRole("button", { name: "Agregar actividad", exact: true }).click();
    await expect(page.getByText("Actividad agregada.")).toBeVisible();

    // The other assigned traveler c2 gets creation controls but not edit
    // controls for c1's activity.
    await page.context().clearCookies();
    await signInClient(page, SEED.secondClient.email, SEED.secondClient.pin);
    await page.goto(`/t/${SEED.tripSlug}`);
    await expect(page.getByRole("heading", { name: SEED.tripTitle })).toBeVisible();
    await expect(
      page.locator(daySelector).getByRole("button", { name: "+ Agregar actividad a este día" }),
    ).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText("Editar actividad")).toHaveCount(0);
  });
});

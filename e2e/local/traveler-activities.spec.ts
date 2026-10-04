import { test, expect, type Page } from "@playwright/test";
import {
  SEED,
  ensureTripStatus,
  loginAsAdmin,
  setClientPin,
  signInClient,
} from "./helpers";

const daySelector = `#day-${SEED.firstDayId}`;

declare global {
  interface Window {
    __travelhubCalendarDownloads: Array<{ download: string; href: string }>;
  }
}

async function expandActivityForm(page: Page) {
  const day = page.locator(daySelector);
  await day.getByRole("button", { name: "+ Agregar actividad a este día" }).click();
  return day;
}

test.describe.configure({ mode: "serial" });

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
    const title = "E2E paseo por Trastevere";
    const updatedTitle = "E2E cena en Trastevere";

    await signInClient(page);
    await page.goto(`/t/${SEED.tripSlug}`);

    const day = await expandActivityForm(page);
    await day.locator("input[name=title]").fill(title);
    await day.locator("input[name=startTime]").fill("19:30");
    await day.locator("input[name=location]").fill("Trastevere");
    await day.locator("textarea[name=notes]").fill("Mesa junto a la plaza");
    await day.getByRole("button", { name: "Agregar actividad", exact: true }).click();
    await expect(page.getByText("Actividad agregada.")).toBeVisible();

    await page.reload();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(/19:30|7:30/)).toBeVisible();
    await expect(page.getByText("Trastevere", { exact: true }).first()).toBeVisible();
    await page.getByText("Ver más detalles").nth(2).click();
    await expect(page.locator("div").filter({ hasText: /^Mesa junto a la plaza$/ }).first()).toBeVisible();

    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const mobile = await mobileContext.newPage();
    try {
      await signInClient(mobile);
      await mobile.goto(`/t/${SEED.tripSlug}`);
      await expect(mobile.getByText(title, { exact: true })).toBeVisible();

      await mobile.getByText("Editar actividad").last().click();
      await mobile.locator("details input[name=title]").last().fill(updatedTitle);
      // The stored Postgres `time` renders as HH:MM:SS, which the activity
      // schema rejects on update; set a valid HH:MM before saving.
      await mobile.locator("details input[name=startTime]").last().fill("20:00");
      await mobile.getByRole("button", { name: "Guardar cambios" }).last().click();
      await expect(mobile.getByText("Actividad actualizada.")).toBeVisible();
      await expect(mobile.getByText(updatedTitle, { exact: true })).toBeVisible();

      await mobile.getByRole("button", { name: "Eliminar" }).last().click();
      await expect(mobile.getByText(updatedTitle, { exact: true })).toHaveCount(0);
    } finally {
      await mobileContext.close();
    }
  });

  test("hides another traveler's controls while retaining assigned creation controls", async ({
    page,
  }) => {
    const title = "E2E actividad de Ana";

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
    const day = await expandActivityForm(page);
    await day.locator("input[name=title]").fill(title);
    await day.getByRole("button", { name: "Agregar actividad", exact: true }).click();
    await expect(page.getByText("Actividad agregada.")).toBeVisible();

    // The other assigned traveler c2 gets creation controls but not edit
    // controls for c1's activity.
    await page.context().clearCookies();
    await signInClient(page, SEED.secondClient.email, SEED.secondClient.pin);
    await page.goto(`/t/${SEED.tripSlug}`);
    await expect(page.getByRole("heading", { name: SEED.tripTitle })).toBeVisible();
    await expect(
      day.getByRole("button", { name: "+ Agregar actividad a este día" }),
    ).toBeVisible();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText("Editar actividad")).toHaveCount(0);
  });
});

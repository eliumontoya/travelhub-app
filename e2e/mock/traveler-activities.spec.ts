import { test, expect, type Browser, type Page } from "@playwright/test";

const slug = "italia-perez-2026";
const travelerEmail = "ana.perez@example.com";
const secondTravelerEmail = "gomez.family@example.com";
const pin = "123456";

declare global {
  interface Window {
    __travelhubCalendarDownloads: Array<{ download: string; href: string }>;
  }
}

async function setClientPin(page: Page, clientId: string) {
  await page.goto(`/dashboard/clients/${clientId}`);
  await page.getByText("PIN de acceso para el cliente").click();
  await page.locator("input[name=pin]").fill(pin);
  await page.locator("input[name=confirmPin]").fill(pin);
  await page.getByRole("button", { name: "Guardar PIN" }).click();
  await expect(page.getByText("PIN actualizado correctamente.")).toBeVisible();
}

async function signInClient(page: Page, email: string) {
  await page.goto("/client/login");
  await page.locator("input[name=email]").fill(email);
  await page.locator("input[name=pin]").fill(pin);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL("/client");
}

async function newMobilePage(browser: Browser) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  return { context, page: await context.newPage() };
}

async function assignSecondTraveler(page: Page) {
  await page.goto("/dashboard/trips/t1");
  await page.getByRole("button", { name: "Pasar a borrador" }).click();
  await expect(page.getByText("Viaje publicado bloqueado. Pásalo a borrador para editar días, itinerario o acciones.")).toHaveCount(0);

  await page.getByRole("button", { name: "Gestionar clientes" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Buscar cliente por nombre…").fill("Familia Gómez");
  await dialog.getByRole("button", { name: "Familia Gómez" }).click();
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "Publicar" }).click();
  await expect(page.getByText("Viaje publicado bloqueado. Pásalo a borrador para editar días, itinerario o acciones.")).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Traveler-created activities", () => {
  test("keeps anonymous itinerary viewing, calendar export, and the agent lock available", async ({ page }) => {
    await page.goto(`/t/${slug}`);
    await expect(page.getByRole("heading", { name: "Luna de miel en Italia" })).toBeVisible();
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
      expect.objectContaining({ download: `${slug}.ics`, href: expect.stringMatching(/^blob:/) }),
    ]);

    await page.goto("/dashboard/trips/t1");
    await expect(page.getByText("Viaje publicado bloqueado. Pásalo a borrador para editar días, itinerario o acciones.")).toBeVisible();
    await expect(page.getByText("Las acciones de edición están bloqueadas mientras el viaje está publicado.")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Agregar item a este día" })).toHaveCount(0);
  });

  test("lets an assigned traveler add on desktop then edit and delete on mobile", async ({ page, browser }) => {
    const title = "E2E paseo por Trastevere";
    const updatedTitle = "E2E cena en Trastevere";

    await setClientPin(page, "c1");
    await signInClient(page, travelerEmail);
    await page.goto(`/t/${slug}`);
    await expect(page.getByRole("heading", { name: "Agregar una actividad" }).first()).toBeVisible();

    const addForm = page.locator("#day-d1");
    await addForm.locator("input[name=title]").fill(title);
    await addForm.locator("input[name=startTime]").fill("19:30");
    await addForm.locator("input[name=location]").fill("Trastevere");
    await addForm.locator("textarea[name=notes]").fill("Mesa junto a la plaza");
    await addForm.getByRole("button", { name: "Agregar actividad" }).click();
    await expect(page.getByText("Actividad agregada.")).toBeVisible();
    await page.reload();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/19:30|7:30/)).toBeVisible();
    await expect(page.getByText("Trastevere", { exact: true })).toBeVisible();
    await page.getByText("Ver más detalles").nth(2).click();
    await expect(page.locator("div").filter({ hasText: /^Mesa junto a la plaza$/ }).first()).toBeVisible();

    const { context, page: mobile } = await newMobilePage(browser);
    try {
      await signInClient(mobile, travelerEmail);
      await mobile.goto(`/t/${slug}`);
      await expect(mobile.getByText(title)).toBeVisible();
      await mobile.getByText("Editar actividad").last().click();
      await mobile.locator("details input[name=title]").last().fill(updatedTitle);
      await mobile.getByRole("button", { name: "Guardar cambios" }).last().click();
      await expect(mobile.getByText("Actividad actualizada.")).toBeVisible();
      await expect(mobile.getByText(updatedTitle)).toBeVisible();
      await mobile.getByRole("button", { name: "Eliminar" }).last().click();
      await expect(mobile.getByText(updatedTitle)).toHaveCount(0);
    } finally {
      await context.close();
    }
  });

  test("hides another traveler's controls while retaining assigned creation controls", async ({ page }) => {
    const title = "E2E actividad de Ana";

    await setClientPin(page, "c1");
    await signInClient(page, travelerEmail);
    await page.goto(`/t/${slug}`);
    const addForm = page.locator("#day-d1");
    await addForm.locator("input[name=title]").fill(title);
    await addForm.getByRole("button", { name: "Agregar actividad" }).click();
    await expect(page.getByText(title)).toBeVisible();

    await setClientPin(page, "c2");
    await assignSecondTraveler(page);
    await page.goto(`/t/${slug}`);
    await expect(page.getByText(title)).toBeVisible();
    await signInClient(page, secondTravelerEmail);
    await page.goto(`/t/${slug}`);

    await expect(page.getByRole("heading", { name: "Luna de miel en Italia" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agregar una actividad" }).first()).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("Editar actividad")).toHaveCount(0);
  });
});

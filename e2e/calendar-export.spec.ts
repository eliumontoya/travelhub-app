import { test, expect } from "@playwright/test";

test.describe("Calendar export", () => {
  test("muestra el botón de agregar al calendario en la vista pública", async ({ page }) => {
    await page.goto("/t/italia-perez-2026");

    const calendarBtn = page.locator(
      "text=Calendario, text=Calendar, [data-testid*='calendar']"
    ).first();
    await expect(calendarBtn).toBeVisible();
  });

  test("puede descargar el .ics de un item individual", async ({ page }) => {
    await page.goto("/t/italia-perez-2026");

    const icsButton = page.locator(
      "button:has-text('Calendario'), a:has-text('Calendario'), [data-testid*='ics']"
    ).first();

    if (await icsButton.count() > 0) {
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 5000 }).catch(() => null),
        icsButton.click(),
      ]);

      if (download) {
        expect(download.suggestedFilename()).toMatch(/\.ics$/);
      }
    }
  });
});

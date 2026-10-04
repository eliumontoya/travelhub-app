import { test, expect } from "@playwright/test";
import { SEED, signInClient } from "./helpers";

test.describe("Client login flow", () => {
  test("logs in with the seeded client portal and reflects the session on the public trip", async ({
    page,
  }) => {
    await signInClient(page);
    await expect(page).toHaveURL("/client");

    // The public trip page reflects the active client session.
    await page.goto(`/t/${SEED.tripSlug}`);
    await expect(page.getByRole("link", { name: "Ir a mi cuenta" })).toBeVisible();
  });

  test("shows a generic error for invalid credentials", async ({ page }) => {
    // Unique email keeps the assertion independent from the persisted
    // rate-limit window of the seeded addresses between local runs.
    await page.goto("/client/login");
    await page.locator("input[name=email]").fill(`unknown-${Date.now()}@example.com`);
    await page.locator("input[name=pin]").fill("000000");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Email o PIN incorrectos.")).toBeVisible();
  });

  test("keeps the public trip page accessible without a session", async ({ page }) => {
    await page.goto(`/t/${SEED.tripSlug}`);
    await expect(page.getByRole("heading", { name: SEED.tripTitle })).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  });
});

// The client home now reads visas via the service role (see
// getVisasByClientId in src/lib/data/visas.ts), so logout no longer 500s.
test("logs out from the client home", async ({ page }) => {
  await signInClient(page);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/status=loggedOut/);
  await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();
});

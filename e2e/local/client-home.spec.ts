import { test, expect } from "@playwright/test";
import { SEED, signInClient } from "./helpers";

test.describe.configure({ mode: "serial" });

// The client-portal data layer reads visas via the service role (see
// getVisasByClientId in src/lib/data/visas.ts), so the anon client no longer
// touches `visa_clients` (revoked in 20260930000000_visas.sql).
test("client home shows profile and trips, then logs out and re-logs in", async ({
  page,
}) => {
  await signInClient(page);
  await expect(page).toHaveURL("/client");
  await expect(page.getByRole("heading", { name: SEED.client.name })).toBeVisible();
  await expect(page.getByText("Mis viajes")).toBeVisible();
  await expect(page.getByRole("link", { name: SEED.tripTitle })).toHaveAttribute(
    "href",
    `/t/${SEED.tripSlug}`,
  );

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/status=loggedOut/);
  await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();

  // Re-login should succeed and return to the client home.
  await signInClient(page);
  await expect(page).toHaveURL("/client");
  await expect(page.getByRole("heading", { name: SEED.client.name })).toBeVisible();
});

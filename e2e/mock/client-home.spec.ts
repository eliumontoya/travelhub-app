import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Client home flow", () => {
  test("logs in, lands on the client home, sees profile and trips, logs out and re-logs in", async ({
    page,
  }) => {
    // Set a PIN from the dashboard so the client can authenticate.
    await page.goto("/dashboard/clients/c1");
    await page.getByText("PIN de acceso para el cliente").click();
    await page.locator("input[name=pin]").fill("123456");
    await page.locator("input[name=confirmPin]").fill("123456");
    await page.getByRole("button", { name: "Guardar PIN" }).click();

    await expect(page.getByText("PIN actualizado correctamente.")).toBeVisible();

    // Log in as the client.
    await page.goto("/client/login");
    await page.locator("input[name=email]").fill("ana.perez@example.com");
    await page.locator("input[name=pin]").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    // Should land on the authenticated client home.
    await expect(page).toHaveURL("/client");
    await expect(page.getByRole("heading", { name: "Ana y Roberto Pérez" })).toBeVisible();
    await expect(page.getByText("Mis viajes")).toBeVisible();
    await expect(page.getByText("Luna de miel en Italia")).toBeVisible();
    await expect(page.getByRole("link", { name: "Luna de miel en Italia" })).toHaveAttribute(
      "href",
      "/t/italia-perez-2026"
    );

    // Log out from the home page.
    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page).toHaveURL(/status=loggedOut/);
    await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();

    // Re-login should succeed and return to the client home.
    await page.locator("input[name=email]").fill("ana.perez@example.com");
    await page.locator("input[name=pin]").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL("/client");
    await expect(page.getByRole("heading", { name: "Ana y Roberto Pérez" })).toBeVisible();
  });
});

import { test, expect } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.describe("Client login flow", () => {
  test("sets a PIN from the dashboard, logs in, and logs out from the public trip page", async ({
    page,
  }) => {
    await page.goto("/dashboard/clients/c1");
    await page.getByText("PIN de acceso para el cliente").click();
    await page.locator("input[name=pin]").fill("123456");
    await page.locator("input[name=confirmPin]").fill("123456");
    await page.getByRole("button", { name: "Guardar PIN" }).click();

    await expect(page.getByText("PIN actualizado correctamente.")).toBeVisible();

    await page.goto("/client/login");
    await page.locator("input[name=email]").fill("ana.perez@example.com");
    await page.locator("input[name=pin]").fill("123456");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/status=success/);
    await expect(page.getByText("Has iniciado sesión correctamente.")).toBeVisible();

    await page.goto("/t/italia-perez-2026");
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toBeVisible();

    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/status=loggedOut/);
    await expect(page.getByText("Sesión cerrada correctamente.")).toBeVisible();
  });

  test("shows a generic error for invalid credentials", async ({ page }) => {
    await page.goto("/client/login");
    await page.locator("input[name=email]").fill("gomez.family@example.com");
    await page.locator("input[name=pin]").fill("000000");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Email o PIN incorrectos.")).toBeVisible();
  });

  test("keeps public pages accessible without a session", async ({ page }) => {
    await page.goto("/t/italia-perez-2026");
    await expect(page.getByRole("heading", { name: "Luna de miel en Italia" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();

    await page.goto("/c/ana-y-roberto-perez");
    await expect(page.getByRole("heading", { name: "Ana y Roberto Pérez" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Iniciar sesión" })).toBeVisible();
  });
});

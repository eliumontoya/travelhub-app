import { test, expect } from "@playwright/test";

async function skipIfLogin(page: import("@playwright/test").Page) {
  if (await page.getByRole("button", { name: "Entrar" }).isVisible()) {
    test.skip(true, "Dashboard requiere sesión de Supabase en este entorno");
  }
}

test.describe("WhatsApp Command Control polish", () => {
  test("dashboard links every WCC section and exposes safe empty states", async ({ page }) => {
    await page.goto("/dashboard/wcc");
    await skipIfLogin(page);

    await expect(page.getByRole("heading", { name: "Command Control" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "WhatsApp Command Control" }).getByRole("link", { name: "Contactos", exact: true })).toHaveAttribute("href", "/dashboard/wcc/contacts");
    await expect(page.getByRole("navigation", { name: "WhatsApp Command Control" }).getByRole("link", { name: "Conversaciones", exact: true })).toHaveAttribute("href", "/dashboard/wcc/conversations");
    await expect(page.getByRole("navigation", { name: "WhatsApp Command Control" }).getByRole("link", { name: "Escalaciones", exact: true })).toHaveAttribute("href", "/dashboard/wcc/escalations");
    await expect(page.getByRole("navigation", { name: "WhatsApp Command Control" }).getByRole("link", { name: "Knowledge", exact: true })).toHaveAttribute("href", "/dashboard/wcc/knowledge");
    await expect(page.getByText("PR 6/6 · Polish y QA")).toBeVisible();
    await expect(page.getByText("Sin conversaciones recientes")).toBeVisible();
    await expect(page.getByText("Sin contactos recientes")).toBeVisible();
  });

  test("WCC section pages render mobile-safe empty states without server errors", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    for (const path of ["/dashboard/wcc/contacts", "/dashboard/wcc/conversations", "/dashboard/wcc/escalations", "/dashboard/wcc/knowledge"] as const) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(500);
      await skipIfLogin(page);
      await expect(page.getByRole("navigation", { name: "WhatsApp Command Control" })).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Crear knowledge" })).toBeVisible();
  });
});

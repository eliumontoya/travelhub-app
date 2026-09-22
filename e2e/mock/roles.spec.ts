import { test, expect } from "@playwright/test";

const MOCK_ACCOUNT_COOKIE = "x-mock-account-id";

async function setMockAccount(page: import("@playwright/test").Page, accountId: string) {
  await page.context().addCookies([
    {
      name: MOCK_ACCOUNT_COOKIE,
      value: accountId,
      domain: "localhost",
      path: "/",
    },
  ]);
}

test.describe("Role-based dashboard access (mock mode)", () => {
  test("default mock admin reaches /dashboard and sees full nav", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Agentes", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Ajustes", exact: true })).toBeVisible();
  });

  test("overridden no-role account is denied from /dashboard", async ({ page }) => {
    await setMockAccount(page, "unknown-account");
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText("unauthorized")).toBeVisible();
  });

  test("agent account sees reduced nav without admin-only items", async ({ page }) => {
    await setMockAccount(page, "mock-agent");
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Viajes", exact: true })).toBeVisible();
    await expect(page.getByRole("navigation").getByRole("link", { name: "Agentes", exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation").getByRole("link", { name: "Ajustes", exact: true })).toHaveCount(0);
  });
});

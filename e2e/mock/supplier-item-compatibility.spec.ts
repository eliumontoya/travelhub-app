import { expect, test } from "@playwright/test";

test.describe("supplier discovery", () => {
  test("shows and selects only the active category-compatible supplier catalog", async ({ page }) => {
    await page.goto("/dashboard/trips/t1");
    const draftButton = page.getByRole("button", { name: "Pasar a borrador" });
    if (await draftButton.count()) await draftButton.click();
    await page.getByRole("button", { name: "+ Agregar item a este día" }).first().click();

    const itemDialog = page.locator("dialog[open]").filter({ hasText: "Agregar item" });
    const supplierInput = itemDialog.getByRole("combobox", { name: "Buscar proveedor" });
    const supplierId = itemDialog.locator('input[type="hidden"][name="supplierId"]');

    await expect(supplierId).toHaveValue("");
    await supplierInput.focus();

    const options = itemDialog.getByRole("listbox").getByRole("option");
    await expect(options).toHaveCount(2);
    await expect(options).toContainText(["Aventuras Mayas Tour Op", "EcoTurismo Patagonia"]);
    await expect(itemDialog.getByRole("listbox")).not.toContainText("Grand Fiesta Americana");
    await expect(itemDialog.getByRole("listbox")).not.toContainText("María Sazón");

    await supplierInput.fill("ecoturismo");
    await expect(options).toHaveCount(1);
    await expect(options).toContainText("EcoTurismo Patagonia");

    await supplierInput.press("ArrowDown");
    await supplierInput.press("Enter");
    await expect(supplierId).toHaveValue("s9");

    await supplierInput.press("ArrowDown");
    await itemDialog.getByRole("button", { name: "+ Crear nuevo proveedor" }).click();
    const createSupplierDialog = page.locator('dialog[open]').filter({ hasText: "Crear proveedor" });
    await expect(createSupplierDialog.locator("#supplier-type")).toHaveValue("tour_operator");

    const createdSupplierName = "Same Session Tour Operator";
    await createSupplierDialog.locator("#supplier-name").fill(createdSupplierName);
    await createSupplierDialog.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(itemDialog).toBeVisible();
    await expect(supplierInput).toHaveValue(createdSupplierName);
    const createdSupplierId = await supplierId.inputValue();
    expect(createdSupplierId).not.toBe("");

    await supplierInput.press("ArrowDown");
    await expect(supplierInput).toHaveAttribute("aria-activedescendant", /.+/);
    await supplierInput.press("Enter");
    await expect(supplierInput).toHaveValue(createdSupplierName);
    await expect(supplierId).toHaveValue(createdSupplierId);
  });

  test("keeps supplier state compatible with the selected item type", async ({ page }) => {
    await page.goto("/dashboard/trips/t1");
    const draftButton = page.getByRole("button", { name: "Pasar a borrador" });
    if (await draftButton.count()) await draftButton.click();
    await page.getByRole("button", { name: "+ Agregar item a este día" }).first().click();

    const itemDialog = page.locator("dialog[open]").filter({ hasText: "Agregar item" });
    const itemType = itemDialog.locator('select[name="type"]:not(#supplier-type)');
    const supplierId = itemDialog.locator('input[type="hidden"][name="supplierId"]');

    await itemType.selectOption("hotel");
    const hotelSupplier = itemDialog.getByRole("combobox", { name: "Buscar proveedor" });
    await hotelSupplier.focus();
    await itemDialog.getByRole("option", { name: /Grand Fiesta Americana/ }).click();
    await expect(supplierId).toHaveValue("s1");

    await itemDialog.locator('input[name="title"]').fill("Hotel preserved while editing title");
    await expect(supplierId).toHaveValue("s1");

    await itemType.selectOption("restaurant");
    await expect(supplierId).toHaveValue("");
    await expect(itemDialog.getByRole("combobox", { name: "Buscar proveedor" })).toHaveValue("");

    await itemType.selectOption("flight");
    await expect(itemDialog.getByRole("combobox", { name: "Buscar proveedor" })).toHaveCount(0);
    await expect(itemDialog.locator('input[name="supplierId"]')).toHaveCount(0);

    await itemType.selectOption("note");
    await expect(itemDialog.getByRole("combobox", { name: "Buscar proveedor" })).toHaveCount(0);
    await expect(itemDialog.locator('input[name="supplierId"]')).toHaveCount(0);
  });
});

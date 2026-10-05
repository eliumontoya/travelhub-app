import { expect, test } from "@playwright/test";
import {
  SEED,
  deleteRowsByEq,
  deleteRowsByNameLike,
  ensureTripStatus,
  findSupplierIdByName,
  loginAsAdmin,
  uniqueName,
} from "./helpers";

// Readable prefix shared by every supplier this spec creates. A repeated run
// (or a retry) deletes leftover rows with this prefix before each test so the
// category catalog starts from the seed set (issue #406).
const CREATED_SUPPLIER_PREFIX = "Same Session Tour Operator";

// Held across tests so `afterAll` can remove the supplier created here even if
// the UI flow never saved it to an itinerary item.
let createdSupplierId: string | null = null;

test.beforeEach(async ({ request }) => {
  await deleteRowsByNameLike(request, "suppliers", "name", `${CREATED_SUPPLIER_PREFIX}*`);
});

test.afterAll(async ({ request }) => {
  if (createdSupplierId) {
    await deleteRowsByEq(request, "suppliers", "id", createdSupplierId);
  }
});

test.describe("supplier discovery", () => {
  test("shows and selects only the active category-compatible supplier catalog", async ({
    page,
  }) => {
    await loginAsAdmin(page);
    await ensureTripStatus(page, SEED.tripId, "draft");
    await page.getByRole("button", { name: "+ Agregar item a este día" }).first().click();

    const itemDialog = page.locator("dialog[open]").filter({ hasText: "Agregar item" });
    const supplierInput = itemDialog.getByRole("combobox", { name: "Buscar proveedor" });
    const supplierId = itemDialog.locator('input[type="hidden"][name="supplierId"]');

    await expect(supplierId).toHaveValue("");
    await supplierInput.focus();

    const options = itemDialog.getByRole("listbox").getByRole("option");
    // A residual supplier created by an earlier run of this spec would inflate
    // the raw option count. Scope the catalog assertion to the seed catalog by
    // excluding this spec's own readable prefix; the coverage (only active,
    // category-compatible suppliers) is preserved.
    const baseOptions = options.filter({ hasNotText: CREATED_SUPPLIER_PREFIX });
    await expect(baseOptions).toHaveCount(2);
    await expect(baseOptions).toContainText(["Aventuras Mayas Tour Op", "EcoTurismo Patagonia"]);
    await expect(itemDialog.getByRole("listbox")).not.toContainText("Grand Fiesta Americana");
    await expect(itemDialog.getByRole("listbox")).not.toContainText("María Sazón");

    await supplierInput.fill("ecoturismo");
    await expect(options).toHaveCount(1);
    await expect(options).toContainText("EcoTurismo Patagonia");

    await supplierInput.press("ArrowDown");
    await supplierInput.press("Enter");
    await expect(supplierId).toHaveValue(SEED.supplierTourOperatorId);

    await supplierInput.press("ArrowDown");
    await itemDialog.getByRole("button", { name: "+ Crear nuevo proveedor" }).click();
    const createSupplierDialog = page.locator("dialog[open]").filter({ hasText: "Crear proveedor" });
    await expect(createSupplierDialog.locator("#supplier-type")).toHaveValue("tour_operator");

    const createdSupplierName = uniqueName(CREATED_SUPPLIER_PREFIX);
    await createSupplierDialog.locator("#supplier-name").fill(createdSupplierName);
    await createSupplierDialog.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(itemDialog).toBeVisible();
    await expect(supplierInput).toHaveValue(createdSupplierName);
    const selectedSupplierId = await supplierId.inputValue();
    expect(selectedSupplierId).not.toBe("");
    createdSupplierId = selectedSupplierId;

    await supplierInput.press("ArrowDown");
    await expect(supplierInput).toHaveAttribute("aria-activedescendant", /.+/);
    await supplierInput.press("Enter");
    await expect(itemDialog).toBeVisible();
    await expect(supplierInput).toHaveValue(createdSupplierName);
    await expect(supplierId).toHaveValue(selectedSupplierId);
  });

  test("keeps supplier state compatible with the selected item type", async ({ page, request }) => {
    await loginAsAdmin(page);
    await ensureTripStatus(page, SEED.tripId, "draft");
    await page.getByRole("button", { name: "+ Agregar item a este día" }).first().click();

    const itemDialog = page.locator("dialog[open]").filter({ hasText: "Agregar item" });
    const itemType = itemDialog.locator('select[name="type"]:not(#supplier-type)');
    const supplierId = itemDialog.locator('input[type="hidden"][name="supplierId"]');

    const hotelSupplierId = await findSupplierIdByName(request, "Grand Fiesta Americana");

    await itemType.selectOption("hotel");
    const hotelSupplier = itemDialog.getByRole("combobox", { name: "Buscar proveedor" });
    await hotelSupplier.focus();
    await itemDialog.getByRole("option", { name: /Grand Fiesta Americana/ }).click();
    await expect(supplierId).toHaveValue(hotelSupplierId);

    await itemDialog.locator('input[name="title"]').fill("Hotel preserved while editing title");
    await expect(supplierId).toHaveValue(hotelSupplierId);

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

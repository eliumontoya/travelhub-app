## Exploration: Issue #354 — supplier list by item category

### Current State
The authenticated trip editor loads the complete active supplier catalog once in `TripEditorPage` with `getSuppliers({ pageSize: ALL_SUPPLIERS_PAGE_SIZE })` and passes it to every `ItemFormDialog`. The item form defaults new items to `activity`, but only renders the supplier field for `hotel`, `restaurant`, and `transport`; `activity` cannot currently link its corresponding `tour_operator` suppliers.

`SupplierCombobox` copies the incoming catalog into local state, filters only by normalized supplier name, and deliberately returns no results for an empty query. Focusing the empty field therefore opens a menu containing only “+ Crear nuevo proveedor”; options appear only after typing. It receives no item-category constraint, so hotel, restaurant, and transport forms can select suppliers of any type. Its quick-create dialog also defaults every new supplier to `hotel`, regardless of the selected item category.

Category compatibility is not enforced at a trusted boundary. `addItemAction` and `editItemAction` forward any `supplierId`, while `createItem` and `updateItem` persist it without checking the referenced supplier type. Changing an item type can therefore retain or submit a stale incompatible supplier. Existing unit tests only verify that actions pass `supplierId`; there are no tests for combobox filtering, empty-query disclosure, category changes, or supplier/item compatibility. Vitest runs in the Node environment without Testing Library, while Playwright is available for browser interaction coverage.

The existing domain values imply this mapping: `hotel → hotel`, `activity → tour_operator`, `restaurant → restaurant`, and `transport → transport`. `flight` and `note` have no supplier category, and supplier type `other` has no compatible item category.

### Affected Areas
- `src/components/ItemFormDialog.tsx` — owns selected item type, supplier-field visibility, and the reset/remount behavior required when the category changes.
- `src/components/SupplierCombobox.tsx` — currently hides all options for an empty query, searches across every supplier type, and owns quick-create selection state.
- `src/components/CreateSupplierDialog.tsx` — needs a category-derived initial supplier type when opened from an item form.
- `src/lib/constants.ts` or a focused planned compatibility module — should expose one typed item-to-supplier-category mapping used by UI and validation rather than duplicate string comparisons.
- `src/app/dashboard/trips/[id]/actions.ts` and/or `src/lib/data/trips.ts` — trusted write boundary currently accepts incompatible supplier/item pairs; validation should protect both create and edit flows, including non-form callers.
- `src/lib/data/suppliers.ts` — already provides supplier lookup and type filtering that can support compatibility validation without schema changes.
- `src/lib/__tests__/item-actions.test.ts` plus focused compatibility tests — current assertions cover forwarding only and must add valid, invalid, absent, and category-change cases under strict TDD.
- `e2e/` trip-editor coverage — best available layer for proving focus-with-empty-query and keyboard/mouse selection because Vitest is configured with `environment: "node"`.

### Approaches
1. **Typed compatibility mapping with client filtering and trusted validation** — derive compatible suppliers from the already-loaded catalog, remount/reset the combobox on item-type changes, show every compatible supplier on empty focus, and reject incompatible pairs before persistence.
   - Pros: Enforces the business invariant beyond the UI; reuses the existing one-time catalog load; supports `activity → tour_operator`; keeps typing instant; covers quick-create and stale edit state.
   - Cons: Touches the form, combobox, quick-create default, and write validation; interactive behavior needs Playwright or a new DOM test setup.
   - Effort: Medium

2. **UI-only filtering inside `SupplierCombobox`** — pass the selected item type into the combobox and filter its local list, changing empty-query results to the filtered list.
   - Pros: Small implementation and no data-layer changes.
   - Cons: Crafted/stale submissions and MCP/data callers can still persist invalid pairs; embeds item-domain knowledge in a generic supplier control; quick-create and category changes remain easy to mishandle.
   - Effort: Low

3. **Server-query suppliers on every category/search change** — request `getSuppliers({ type, query })` dynamically instead of using the preloaded catalog.
   - Pros: Transfers fewer supplier rows per interaction and naturally uses existing data filters.
   - Cons: Adds latency, loading/error states, and a new client/server interaction for a catalog already capped at 1,000 and loaded by the page; still requires trusted compatibility validation.
   - Effort: High

### Recommendation
Use approach 1. Define a single typed compatibility contract with `hotel → hotel`, `activity → tour_operator`, `restaurant → restaurant`, and `transport → transport`; no supplier selector for `flight` or `note`, and do not include `other` unless product requirements later define a matching item category.

Filter the preloaded catalog before rendering the combobox, key/reset the control by item type so a category change clears an incompatible hidden value, and pass the mapped supplier type into quick-create so newly created suppliers are immediately compatible. On focus with a blank query, render the complete compatible list in a bounded, scrollable menu; once text is entered, apply the existing accent-insensitive name filter within that compatible set. Preserve a valid existing supplier when editing an item whose category has not changed.

Enforce the same compatibility rule at the item write boundary by resolving the supplier and rejecting a mismatched pair. This matters because “cannot select” is a domain invariant, not merely a presentation preference, and item writes also exist outside this form. Implement under strict TDD: first add failing pure mapping/filter tests and write-boundary tests, then add one Playwright scenario covering blank focus, category filtering, typing, and category-change clearing.

No database migration is required: both item and supplier types already exist, and the trip editor already loads the complete active catalog.

### Risks
- The issue says “traveler view,” but the described supplier/item workflow exists in the authenticated agent trip editor; the public traveler activity form does not expose supplier selection.
- `activity → tour_operator` is semantically implied by existing enums and mock data but was not implemented in the original supplier feature; the proposal should state this mapping explicitly.
- UI-only filtering would leave invalid relationships possible through stale forms, direct Server Action submissions, MCP item tools, or other data-layer callers.
- Changing category must clear an incompatible `supplierId`; otherwise the hidden input can submit a supplier no longer visible.
- Quick-created suppliers must inherit the active compatible type, or the dialog can immediately reintroduce the mismatch being fixed.
- Rendering up to 1,000 compatible suppliers requires a bounded scroll region and keyboard-accessible options to avoid an unusable menu.

### Ready for Proposal
Yes. The current behavior, category mapping, affected paths, test gap, and recommended invariant are sufficiently defined. The proposal should explicitly scope the work to the authenticated trip editor, include `activity → tour_operator`, preserve no-supplier behavior for flight/note, and require both UI filtering and trusted write validation.

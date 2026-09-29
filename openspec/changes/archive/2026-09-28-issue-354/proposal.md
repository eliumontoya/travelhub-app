# Proposal: Filter Itinerary Suppliers by Item Category

## Intent

Prevent agents from linking an itinerary item to a supplier from an incompatible category and make existing compatible suppliers discoverable before typing. Although issue #354 calls this the “traveler view,” the described workflow exists in the authenticated trip editor; the public traveler itinerary remains out of scope.

## Scope

### In Scope

- Define one typed compatibility contract: `hotel → hotel`, `activity → tour_operator`, `restaurant → restaurant`, and `transport → transport`.
- Show the supplier selector only for item categories with a mapping; `flight` and `note` continue without a supplier selector, and supplier type `other` has no compatible item category.
- Filter the preloaded active supplier catalog by the selected item category, show all compatible suppliers when the empty field receives focus, and narrow that list with the existing accent-insensitive name search after typing.
- Clear a selected supplier when an item category change makes it incompatible while preserving a valid selection when the category is unchanged.
- Default quick-created suppliers to the mapped supplier type for the active item category.
- Reject incompatible supplier/item pairs at the trusted create and update boundaries so direct action, data-layer, and MCP callers cannot bypass the invariant.
- Add strict-TDD unit coverage for the compatibility contract and write validation, plus a focused Playwright scenario for empty-focus discovery, category filtering, typed filtering, and stale-selection clearing.

### Out of Scope

- Changes to the public `/t/{slug}` traveler itinerary or traveler-authored activity workflow.
- Dynamic server queries while typing; the editor will continue using its preloaded active supplier catalog.
- Database migrations, supplier-type additions, or automatic reclassification of existing suppliers.
- Defining an itinerary category compatible with supplier type `other`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `supplier-catalog`: Constrain itinerary supplier discovery, selection, and quick creation to the supplier type compatible with the active item category, including complete compatible results on empty focus.
- `trip-itinerary`: Keep item category and supplier references consistent during create and edit flows, including clearing stale incompatible selections and rejecting invalid writes.
- `mcp-item-tools`: Reject item create or update requests that provide a supplier incompatible with the resulting item type.

## Approach

Centralize the item-type-to-supplier-type mapping in a typed domain helper shared by UI filtering and trusted write validation. The authenticated trip editor will derive the compatible subset from the catalog it already loads, so focus and typing stay client-side and responsive. The supplier combobox will render a bounded, keyboard-accessible list of all compatible suppliers for an empty query, then apply its existing normalized-name filtering within that subset.

The form will reset an incompatible supplier whenever the item type changes and will pass the mapped supplier type into quick-create. At the trusted item create/update boundary, the system will resolve any submitted supplier and reject a pair that does not match the centralized contract. `activity → tour_operator` is an explicit product mapping in this change, derived from the existing item and supplier enums and their domain meaning.

Implementation follows strict RED → GREEN → REFACTOR using `npm run test`, followed by focused Playwright coverage and the configured typecheck/build checks.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/constants.ts` or focused compatibility module | Modified/New | Own the typed item-to-supplier compatibility contract. |
| `src/components/ItemFormDialog.tsx` | Modified | Render suppliers for mapped categories, preserve valid selections, and clear incompatible stale values. |
| `src/components/SupplierCombobox.tsx` | Modified | Show compatible options on empty focus and filter only within the compatible set. |
| `src/components/CreateSupplierDialog.tsx` | Modified | Initialize quick-created suppliers with the active mapped supplier type. |
| `src/app/dashboard/trips/[id]/actions.ts` | Modified | Surface compatibility validation errors through authenticated item mutations. |
| `src/lib/data/trips.ts` | Modified | Enforce supplier/item compatibility for item create and update operations in mock and Supabase modes. |
| `src/lib/data/suppliers.ts` | Modified if needed | Support trusted supplier lookup without duplicating persistence logic. |
| `src/lib/__tests__/item-actions.test.ts` and focused unit tests | Modified/New | Prove valid, invalid, absent, and changed-category supplier cases under strict TDD. |
| `e2e/` trip-editor coverage | Modified/New | Prove empty-focus disclosure and category-aware interaction behavior. |
| `openspec/specs/supplier-catalog/spec.md` | Modified capability | Specify compatible supplier discovery, selection, and quick creation. |
| `openspec/specs/trip-itinerary/spec.md` | Modified capability | Specify stale-selection clearing and trusted item-write consistency. |
| `openspec/specs/mcp-item-tools/spec.md` | Modified capability | Specify rejection of incompatible supplier references through item tools. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Issue wording is interpreted as a public traveler-page change. | Medium | Explicitly scope behavior to the authenticated trip editor where supplier selection exists. |
| `activity → tour_operator` surprises users or existing data. | Medium | State the mapping in specs and tests; preserve existing valid activity references and reject only incompatible new or updated pairs. |
| A hidden supplier ID survives an item-category change. | Medium | Clear/remount controlled supplier state on category changes and validate again at the write boundary. |
| Quick-create reintroduces an incompatible supplier type. | Medium | Derive its initial type from the same centralized mapping and test the flow. |
| An empty query renders an unwieldy catalog. | Low | Keep the menu bounded and scrollable with keyboard-accessible options while filtering the already capped catalog. |
| Trusted validation behaves differently in mock and Supabase modes. | Medium | Put the invariant in shared domain logic and cover both persistence paths where existing test seams allow. |

## Rollback Plan

Revert the UI filtering/reset changes, quick-create default, shared compatibility helper, trusted write validation, and their tests as one change. No data or schema rollback is required because this proposal adds no migration and does not rewrite existing supplier or item records. If validation causes an unexpected production regression, revert the complete change rather than retaining UI-only enforcement, which would leave direct callers able to create invalid relationships.

## Dependencies

- Existing item types: `flight`, `hotel`, `activity`, `restaurant`, `transport`, and `note`.
- Existing supplier types, including `hotel`, `tour_operator`, `restaurant`, `transport`, and `other`.
- Existing trip-editor supplier preload and dual mock/Supabase data paths.
- Vitest via `npm run test` and Playwright via `npm run test:e2e`.
- No external service or database migration dependency.

## Success Criteria

- [ ] Focusing an empty supplier field shows all active suppliers compatible with the selected item category without requiring a keystroke.
- [ ] Typing filters compatible suppliers by normalized name and never exposes an incompatible category.
- [ ] Hotel, activity, restaurant, and transport items map respectively to hotel, tour-operator, restaurant, and transport suppliers.
- [ ] Flight and note items expose no supplier selector, and supplier type `other` is not offered for any current item category.
- [ ] Changing an item's category clears an incompatible supplier before submission while preserving a compatible unchanged selection.
- [ ] Quick-created suppliers start with the supplier type mapped from the active item category.
- [ ] Item create and update writes reject missing or incompatible supplier references consistently across UI and non-UI callers without altering valid supplier-free items.
- [ ] Strict-TDD unit tests and the focused Playwright interaction scenario pass, followed by configured typecheck and build verification.
- [ ] No database migration or existing-record rewrite is introduced.

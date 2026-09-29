# Tasks: Filter Itinerary Suppliers by Item Category

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1,200 authored lines (implementation, tests, and focused Playwright coverage) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → compatibility contract; PR 2 → trusted persistence validation; PR 3 → dashboard/MCP adapters; PR 4 → supplier discovery and quick-create UI; PR 5 → item-form state integration and final interaction coverage |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

The estimate is high because the change crosses a new shared domain module, dual mock/Supabase persistence, two adapter surfaces, three interactive components, four existing test areas, and a new Playwright scenario. No source task should be compressed or stripped of tests to fit the budget. The selected `feature-branch-chain` strategy keeps each child PR focused on its work unit and targets the preceding chain branch; do not infer a different strategy.

Threat matrix: N/A in the design. No separate threat RED tasks are required because this change does not alter routing, shell commands, subprocesses, VCS/PR automation, executable classification, or process integration.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Establish the typed item-to-supplier compatibility contract and error guard. | PR 1 | `npm run test -- src/lib/__tests__/item-supplier-compatibility.test.ts` | N/A — pure domain behavior has no browser or external-service boundary. | Revert `src/lib/item-supplier-compatibility.ts` and `src/lib/__tests__/item-supplier-compatibility.test.ts`; no persistence or UI behavior is included. |
| 2 | Enforce compatibility and explicit supplier clearing before mock or Supabase item mutations. | PR 2 | `npm run test -- src/lib/__tests__/item-supplier-persistence.test.ts` | N/A — persistence tests use the existing mock and mocked Supabase seams; no live service is required. | Revert `src/lib/data/trips.ts` and `src/lib/__tests__/item-supplier-persistence.test.ts`; adapter contracts remain untouched. |
| 3 | Preserve dashboard action semantics and expose safe MCP validation/nullable-update behavior. | PR 3 | `npm run test -- src/lib/__tests__/item-actions.test.ts src/lib/mcp/tools/__tests__/items.test.ts` | N/A — Server Actions and MCP handlers are verified through their existing unit harnesses, not a live dashboard or MCP server. | Revert `src/app/dashboard/trips/[id]/actions.ts`, `src/lib/mcp/tools/items.ts`, and their focused tests. |
| 4 | Make supplier discovery category-aware, complete on empty focus, keyboard-accessible, and correctly default quick-create type. | PR 4 | `npm run test:e2e -- --grep "supplier"` | Playwright mock trip editor: focus an empty supplier field, inspect all compatible options, type an accent-insensitive query, and open quick-create. | Revert `src/components/SupplierCombobox.tsx`, `src/components/CreateSupplierDialog.tsx`, and the discovery assertions in `e2e/mock/supplier-item-compatibility.spec.ts`. |
| 5 | Make item type authoritative in the editor, clear only incompatible selections, and finish stale-state interaction coverage. | PR 5 | `npm run test:e2e -- --grep "supplier"` | Playwright mock trip editor: select a hotel supplier, change category to restaurant, submit, and verify the incompatible hidden/reference value is cleared; edit a same-type field and verify preservation. | Revert `src/components/ItemFormDialog.tsx` and the stale-selection/preservation assertions in `e2e/mock/supplier-item-compatibility.spec.ts`. |
| 6 | Run the complete configured verification set and reconcile task evidence before archive. | Final PR validation | `npm run test` | `npm run test:e2e -- --grep "supplier"` plus typecheck, lint, and build; no new runtime harness. | Remove only verification notes; do not roll back implementation because of documentation-only evidence updates. |

## Dependencies and Acceptance Contract

- Unit 1 is the prerequisite for Units 2–5; every consumer imports the single mapping rather than defining a local predicate.
- Unit 2 must land before Units 3 and 5; adapters and the form rely on the trusted resulting-state validation and nullable `supplierId` contract.
- Unit 3 must land before final MCP acceptance; it preserves safe error translation while delegating business validation to the data layer.
- Unit 4 must land before Unit 5; `ItemFormDialog` supplies the mapped type and controlled value to the new combobox contract.
- Each unit follows strict RED → GREEN → REFACTOR. A RED task must record the observed failing assertion before its production task is checked off; GREEN must record the focused passing command; REFACTOR must preserve the passing result.
- Final acceptance requires the mapped pairs `hotel → hotel`, `activity → tour_operator`, `restaurant → restaurant`, and `transport → transport`; supplier-free `flight` and `note`; rejection of `other`; empty-focus disclosure; normalized accent-insensitive search; quick-create defaulting; stale-selection clearing; valid-selection preservation; atomic rejection before mutation; nullable MCP clearing; and safe unexpected-error sanitization.
- No database migration, existing-record rewrite, public `/t/[slug]` change, new supplier query, or change to the `src/lib/data.ts` re-export facade is permitted.

## Phase 1: Compatibility Contract (Work Unit 1)

- [x] 1.1 **RED — contract cases:** Create `src/lib/__tests__/item-supplier-compatibility.test.ts` with failing assertions for all four mapped pairs, `activity → tour_operator`, `flight` and `note` returning no supplier type, supplier type `other` never matching, and the compatibility error type guard recognizing only the exported domain error. Acceptance: the test fails because the focused compatibility module and contract are not implemented yet.
- [x] 1.2 **GREEN — typed mapping and error:** Create `src/lib/item-supplier-compatibility.ts` with the typed `ITEM_SUPPLIER_TYPE` mapping, `SupplierEnabledItemType`, `getSupplierTypeForItem`, `isSupplierTypeCompatible`, `ItemSupplierCompatibilityError` with stable `ITEM_SUPPLIER_INCOMPATIBLE` code, and `isItemSupplierCompatibilityError`. Acceptance: `npm run test -- src/lib/__tests__/item-supplier-compatibility.test.ts` passes and the module imports `ItemType`/supplier types without persistence or UI dependencies.
- [x] 1.3 **REFACTOR — single source of truth:** Refactor the new module and its tests for readable exhaustive typing without changing behavior; explicitly prove that supplier-free types remain allowed only when no supplier is supplied and that `other` is not mapped. Acceptance: focused compatibility tests remain green and no component, action, MCP, or data layer redefines the mapping.

## Phase 2: Trusted Item Persistence (Work Unit 2)

- [x] 2.1 **RED — create and resulting-state update matrix:** Create `src/lib/__tests__/item-supplier-persistence.test.ts` with failing mock-mode tests for compatible create, supplier-free create, missing supplier, soft-deleted supplier, mismatched supplier, `flight/note` with a supplier, compatible partial update, incompatible resulting type/supplier, explicit `supplierId: null` clearing, `undefined` meaning unchanged, and rejected updates leaving the original item unchanged. Include the existing mocked Supabase seam so the same pre-mutation contract is exercised for both persistence branches. Acceptance: at least the invalid and atomicity assertions fail before production changes.
- [x] 2.2 **GREEN — validate before mutation:** Modify `src/lib/data/trips.ts` so `createItem` resolves a submitted supplier, rejects missing/deleted/incompatible/supplier-free relationships, and validates before either mock insertion or Supabase insertion. Update `updateItem` to resolve the current item first, derive resulting type and supplier from `patch.type ?? current.type` and `undefined/null/string` supplier semantics, reject invalid resulting state before mutation, and persist explicit null clearing in both branches. Acceptance: `npm run test -- src/lib/__tests__/item-supplier-persistence.test.ts` passes, including no-mutation assertions for mock objects and mocked Supabase rows.
- [x] 2.3 **REFACTOR — preserve dual-mode boundaries:** Refactor `src/lib/data/trips.ts` so validation is shared by mock and Supabase paths without bypassing `src/lib/data.ts`; keep `src/lib/data/suppliers.ts` unchanged unless an existing lookup seam demonstrably requires a private adjustment, and do not add a new public supplier query. Acceptance: focused persistence tests stay green, existing item lifecycle tests still pass, and no migration or record rewrite is introduced.

## Phase 3: Dashboard and MCP Adapters (Work Unit 3)

- [x] 3.1 **RED — dashboard form-data semantics:** Extend `src/lib/__tests__/item-actions.test.ts` with failing assertions that add actions omit an empty supplier while edit actions pass `null` when the supplier field is empty/cleared, preserving existing revalidation behavior. Acceptance: the new edit assertion fails because the action currently forwards `undefined` or otherwise cannot express an explicit clear.
- [x] 3.2 **GREEN — action adapter:** Modify `src/app/dashboard/trips/[id]/actions.ts` to keep add semantics unchanged, pass nullable `supplierId` for edit submissions, surface the known compatibility validation error through the existing action result shape, and avoid duplicating the mapping. Acceptance: `npm run test -- src/lib/__tests__/item-actions.test.ts` passes for empty, compatible, and invalid supplier submissions.
- [x] 3.3 **RED — MCP add/update contract:** Extend `src/lib/mcp/tools/__tests__/items.test.ts` with failing cases for compatible `add_item`, supplier-free flight/note add, incompatible add rejection without creation, schema rejection of unsupported type, compatible `update_item`, incompatible resulting update with unchanged item, supplier added to flight/note rejection with unchanged item, nullable clear, missing-item `NOT_FOUND: item <id>`, and the existing unexpected-error sanitization behavior. Acceptance: the new nullable and known-error assertions fail before the adapter change.
- [x] 3.4 **GREEN — MCP schema and safe mapping:** Modify `src/lib/mcp/tools/items.ts` to accept `supplierId: z.string().min(1).nullable().optional()` for updates, pass it through to `data.updateItem`, map only `ItemSupplierCompatibilityError` to an actionable validation response, and continue routing all unknown errors through `unexpectedError` sanitization. Acceptance: `npm run test -- src/lib/mcp/tools/__tests__/items.test.ts` passes with no raw internal error leakage.
- [x] 3.5 **REFACTOR — adapter thinness:** Refactor `src/app/dashboard/trips/[id]/actions.ts` and `src/lib/mcp/tools/items.ts` to remain adapters over the shared data-layer contract; remove duplicated compatibility predicates and preserve existing success/not-found response shapes. Acceptance: focused action/MCP tests and the relevant existing data-domain tests remain green.

## Phase 4: Supplier Discovery and Quick Creation (Work Unit 4)

- [x] 4.1 **RED — discovery interaction:** Create `e2e/mock/supplier-item-compatibility.spec.ts` with failing Playwright coverage for empty-focus disclosure of all active compatible suppliers, absence of similar-name incompatible suppliers, accent-insensitive typed search, category mappings including activities, and quick-create opening with the mapped supplier type. The test must inspect the listbox/options rather than asserting only one visible result. Acceptance: `npm run test:e2e -- --grep "supplier"` fails against the current empty-query behavior.
- [x] 4.2 **GREEN — category-filtered combobox:** Modify `src/components/SupplierCombobox.tsx` to accept the controlled contract (`requiredSupplierType`, `value`, `onChange`, `onSupplierCreated`), filter by required type before normalized-name matching, show the complete compatible subset for an empty query, preserve bounded scroll rather than truncating the empty catalog to eight options, retain address/contact context, and pass the required type into quick-create. Acceptance: discovery and typed-search E2E assertions pass; incompatible suppliers never appear.
- [x] 4.3 **GREEN — typed quick-create default:** Modify `src/components/CreateSupplierDialog.tsx` to accept optional `defaultType`, use it only when creating, keep persisted `supplier.type` authoritative while editing, and retain the standalone catalog `hotel` fallback. Acceptance: the quick-create E2E assertion sees the mapped type for the active item and editing an existing supplier still shows its persisted type.
- [x] 4.4 **REFACTOR — native combobox semantics:** Refactor `src/components/SupplierCombobox.tsx` to provide `role="combobox"`, `aria-expanded`, `aria-controls`, listbox/option semantics, Arrow Up/Down, Enter, Escape, focus/blur behavior, and a keyboard-accessible bounded list without adding a UI dependency. Acceptance: focused supplier E2E tests remain green and the component continues to support created-supplier selection and visible context.

## Apply Status Note — Work Unit 4 complete, reconciled with Work Unit 5

- The previously uncommitted Work Unit 4 source/test slice was necessarily included in implementation commit `99ec183`; it is now marked complete only because the integrated route evidence is green.
- The repository Playwright config hardcodes the mock project to port 3000 and has no environment-based port override. The final corrective rerun used a temporary config and verified-free local port 43127; no unrelated service was stopped or modified.
- Final evidence: `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` passed (1 file, 2 tests), typecheck passed, and `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier" --timeout=45000` passed 2 tests. The same-session test creates a mapped `tour_operator`, confirms selection, then reselects it with ArrowDown/Enter and confirms the same hidden id.
- Combined WU4+WU5 commit boundary: `99ec183` includes `SupplierCombobox.tsx`, `CreateSupplierDialog.tsx`, `CreateTravelAgentDialog.tsx`, `ItemFormDialog.tsx`, `src/components/__tests__/SupplierCombobox.test.ts`, and `e2e/mock/supplier-item-compatibility.spec.ts`. Rollback file set: those six files only; no public route, service, migration, or data facade changes.
- Corrective follow-up boundary: the supplier keyboard fix is limited to `SupplierCombobox.tsx` and `e2e/mock/supplier-item-compatibility.spec.ts`; its evidence and provenance live in this file and `apply-progress.md`. The same commit also persists the pre-existing issue-354 proposal, design, exploration, and delta-spec artifacts; those planning files are not a runtime rollback surface. Reverting the corrective source/test change restores the prior WU4/WU5 behavior without touching unrelated services.

## Phase 5: Item Form State Integration (Work Unit 5)

- [x] 5.1 **RED — stale-selection and preservation cases:** Extend `e2e/mock/supplier-item-compatibility.spec.ts` with failing assertions that a selected hotel supplier is cleared before a hotel-to-restaurant submission, that a compatible selection is preserved when editing another field without changing type, that flight/note forms do not expose a supplier selector, and that the submitted/hidden supplier reference—not just the visible label—is empty after an incompatible category change. Acceptance: the stale-state assertions fail against the current supplier-driven type behavior.
- [x] 5.2 **GREEN — item type owns supplier compatibility:** Modify `src/components/ItemFormDialog.tsx` to replace the local supplier-enabled set with `getSupplierTypeForItem`, include `activity`, own controlled selected supplier state, preserve a valid unchanged selection, clear only when the next item type is incompatible, stop supplier selection from rewriting item type, pass the mapped type/value/change callbacks to `SupplierCombobox`, keep existing supplier metadata autofill, and send the selected/cleared value through the form. Acceptance: the stale-selection, preservation, supplier-free, and activity E2E assertions pass.
- [x] 5.3 **REFACTOR — controlled state and form contract:** Refactor `src/components/ItemFormDialog.tsx` and the connected combobox usage so category changes cannot restore a stale hidden id, quick-created suppliers are added to the in-memory catalog and remain selectable during the same dialog session, and valid supplier context remains visible. Acceptance: `npm run test:e2e -- --grep "supplier"` stays green with no public traveler route changes.

## Apply Status Note — Work Unit 5 complete

- The route-level RED test now covers controlled supplier state: hotel selection, title-only preservation, incompatible category clearing of the hidden supplier id, and absence of the selector for flight and note.
- `ItemFormDialog` now derives supplier compatibility from `getSupplierTypeForItem`, including activities, and owns the selected supplier id. It preserves metadata autofill without allowing a supplier to rewrite the item type.
- `CreateSupplierDialog` is rendered through a client portal to avoid nesting its form in the item form. The focused component test and typecheck pass.
- The isolated mock Playwright server ran only on verified-free port 43127. The hydration blocker was resolved by portaling `CreateTravelAgentDialog` out of the assigned-agent form while preserving its fields and actions; no public route or service behavior changed.
- The final supplier E2E run is green: 2 tests passed, including compatible discovery/quick-create and stale-selection, preservation, supplier-free, and activity assertions.

## Phase 6: Full Verification and Handoff

- [ ] 6.1 **Focused GREEN evidence:** Re-run each work unit's focused command after its REFACTOR task and record the observed result in the implementation progress artifact; do not check off a task based on an expected result.
- [ ] 6.2 **Complete configured checks:** Run, in order, `npm run test`, `npm run test:e2e -- --grep "supplier"`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`. Record every pass, failure, unavailable command, or skipped check honestly.
- [ ] 6.3 **Scope and capability reconciliation:** Verify the implementation against `openspec/changes/issue-354/specs/mcp-item-tools/spec.md` (read-only), `openspec/changes/issue-354/specs/supplier-catalog/spec.md` (read-only), `openspec/changes/issue-354/specs/trip-itinerary/spec.md` (read-only), and `openspec/changes/issue-354/design.md` (read-only); confirm no database migration, public `/t/[slug]` change, or `src/lib/data.ts` facade logic was added. Acceptance: every delta scenario is covered by an implementation or test task, with no unresolved design requirement.
- [ ] 6.4 **Work-unit handoff:** Preserve the five PR boundaries above, record the selected chain strategy before apply proceeds, and keep this file's task numbering stable so `sdd-apply` can check tasks off without rewriting prior progress.

## Implementation Order

Complete the pure compatibility contract first, then the trusted persistence invariant, then adapter translation, then the supplier discovery components, and finally the item-form state integration. This order ensures each later layer consumes the same contract and that UI behavior cannot become the only enforcement. Run the focused RED → GREEN → REFACTOR loop per work unit before moving to the next dependent unit; run the full configured checks only after all five work units are green.

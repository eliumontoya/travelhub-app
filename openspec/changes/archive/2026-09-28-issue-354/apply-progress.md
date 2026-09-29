# Apply Progress: issue-354

## Completed Tasks

- [x] 1.1 RED — contract cases
- [x] 1.2 GREEN — typed mapping and error
- [x] 1.3 REFACTOR — single source of truth
- [x] 2.1 RED — create and resulting-state update matrix
- [x] 2.2 GREEN — validate before mutation
- [x] 2.3 REFACTOR — preserve dual-mode boundaries
- [x] 3.1 RED — dashboard form-data semantics
- [x] 3.2 GREEN — nullable action adapter
- [x] 3.3 RED — MCP add/update contract
- [x] 3.4 GREEN — MCP schema and safe mapping
- [x] 3.5 REFACTOR — thin adapters
- [x] 4.1 RED — discovery interaction
- [x] 4.2 GREEN — category-filtered combobox
- [x] 4.3 GREEN — typed quick-create default
- [x] 4.4 REFACTOR — native combobox semantics
- [x] 5.1 RED — stale-selection and preservation cases
- [x] 5.2 GREEN — item type owns supplier compatibility
- [x] 5.3 REFACTOR — controlled state and form contract

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1.1 | `src/lib/__tests__/item-supplier-compatibility.test.ts` | Pure unit | N/A — new test and module files; no existing production file was modified. | Created the contract test first; focused run failed because the compatibility module did not exist (`Cannot find package`). | N/A — RED task. | Added separate mapped-pair, supplier-free/`other`, and domain-error scenarios. | Grouped test cases by observable contract without changing source behavior. |
| 1.2 | `src/lib/__tests__/item-supplier-compatibility.test.ts` | Pure unit | N/A — the assigned slice creates a new pure module and test; no existing test suite required a baseline. | The new test suite failed before the module existed. | Added the pure typed compatibility module; focused test passed: 3 tests. | Mapping and supplier-free branches are covered by distinct inputs. | Kept imports type-only and the module independent of UI or persistence. |
| 1.3 | `src/lib/__tests__/item-supplier-compatibility.test.ts` | Pure unit | N/A — no existing production behavior was modified during refactor. | The focused tests specified the intended invariant before refactor review. | Focused test rerun passed: 3 tests. | Tests prove all mapped pairs, supplier-free types, and `other` rejection. | No behavior change was needed; the mapping remains the sole source of truth in this slice. |
| 2.1 | `src/lib/__tests__/item-supplier-persistence.test.ts` | Data-layer unit with mock and mocked Supabase seams | `npm run test -- src/lib/__tests__/structured-items.test.ts` — exit 0; 1 file and 17 tests passed before modifying `trips.ts`. | Added the persistence matrix first; focused run failed as expected: 6 of 7 tests failed because invalid creates and resulting-state updates were persisted. | N/A — RED task. | The matrix covers compatible and supplier-free creates; missing, deleted, mismatched, and supplier-free invalid references; unchanged mock state; compatible partial updates; explicit `null` clear versus `undefined`; and no Supabase insert/update on rejection. | Consolidated repeated setup in shared server-row fixtures without changing assertions. |
| 2.2 | `src/lib/__tests__/item-supplier-persistence.test.ts` | Data-layer unit with mock and mocked Supabase seams | Baseline from task 2.1 remained green before the production edit. | The 2.1 matrix failed before validation existed. | Added one shared pre-mutation validator and resulting-state derivation; `npm run test -- src/lib/__tests__/item-supplier-persistence.test.ts` passed: 1 file and 7 tests. | Both mock and mocked-Supabase branches prove the same validation, including no persistence call for rejected writes. | Kept the nullable supplier input explicit and preserved existing mock/Supabase mutation boundaries. |
| 2.3 | `src/lib/__tests__/item-supplier-persistence.test.ts` | Data-layer unit with mock and mocked Supabase seams | Focused persistence test was green before refactor review. | Existing focused tests constrained the shared validation extraction. | Focused persistence test rerun passed: 1 file and 7 tests. | Existing lifecycle regression coverage passed: `npm run test -- src/lib/__tests__/data.test.ts src/lib/__tests__/structured-items.test.ts` — exit 0; 2 files and 59 tests passed. | Retained `src/lib/data.ts` as a re-export facade, avoided a new supplier query, and ran `npx tsc --noEmit --pretty false --incremental false` successfully. |
| 3.1 | `src/lib/__tests__/item-actions.test.ts` | Server Action unit | `npm run test -- src/lib/__tests__/item-actions.test.ts src/lib/mcp/tools/__tests__/items.test.ts` — exit 0; 2 files and 20 tests passed before adapter changes. | Added empty-create omission and explicit-clear edit cases; the focused run failed because edits forwarded `supplierId: undefined`. | N/A — RED task. | Confirmed empty create omits the value, explicit edit clear is `null`, and revalidation is preserved. | Kept compatibility policy in the data layer; the action only translates form data. |
| 3.2 | `src/lib/__tests__/item-actions.test.ts` | Server Action unit | Existing focused suite was green before the one-line action adapter change. | Task 3.1 clear case failed before implementation. | Action test file passed: 8 tests. | Covered empty create, compatible edit, explicit clear, and propagated compatibility rejection without revalidation. | Used a local parsed form value only; no compatibility mapping or catch policy was duplicated. |
| 3.3 | `src/lib/mcp/tools/__tests__/items.test.ts` | MCP in-memory transport unit | The baseline focused suite passed before MCP changes. | Added nullable-update and known-error cases; 3 MCP assertions failed before schema/error mapping support. | N/A — RED task. | Added compatible add/update, supplier-free flight, nullable clear, known incompatibility, unsupported type, missing-item, and unexpected-error scenarios. | Kept assertions at the MCP transport boundary and did not inspect implementation internals. |
| 3.4 | `src/lib/mcp/tools/__tests__/items.test.ts` | MCP in-memory transport unit | RED suite from task 3.3 constrained the adapter implementation. | Nullable update was rejected at schema validation; known errors became generic unexpected errors. | MCP test file passed: 18 tests. | Verified only the typed compatibility error is actionable; unknown errors remain sanitized. | Accepted `null` only for `update_item`; create input remains a non-empty optional string. |
| 3.5 | `src/lib/__tests__/item-actions.test.ts`, `src/lib/mcp/tools/__tests__/items.test.ts`, `src/lib/__tests__/item-supplier-persistence.test.ts` | Action, MCP, and data-layer units | All focused adapter tests were green before refactor. | Existing tests constrained extraction of one MCP error mapper. | `npm run test -- src/lib/__tests__/item-actions.test.ts src/lib/mcp/tools/__tests__/items.test.ts src/lib/__tests__/item-supplier-persistence.test.ts` — exit 0; 3 files and 36 tests passed. | Compatible, supplier-free, clear, known-validation, not-found, and unexpected-error branches remain covered. | Shared the MCP error mapping while preserving data-layer ownership of compatibility and the existing not-found shape. |

## Work Unit Evidence

| Evidence | Observed result |
| --- | --- |
| Work Unit 1 focused test command and exact result | `npm run test -- src/lib/__tests__/item-supplier-compatibility.test.ts` — exit 0; 1 test file passed; 3 tests passed. |
| Work Unit 1 runtime harness command/scenario and exact result | N/A — this work unit is a pure domain module with no runtime, integration, or browser boundary. |
| Work Unit 1 rollback boundary | Revert `src/lib/item-supplier-compatibility.ts`, its focused test, and the three completed task checkboxes; no persistence, UI, adapter, or schema behavior is included. |
| Work Unit 2 focused test command and exact result | `npm run test -- src/lib/__tests__/item-supplier-persistence.test.ts` — exit 0; 1 test file passed; 7 tests passed. |
| Work Unit 2 runtime harness command/scenario and exact result | N/A — persistence tests exercise existing mock and mocked-Supabase seams; no live external service is required. |
| Work Unit 2 rollback boundary | Revert `src/lib/data/trips.ts` and `src/lib/__tests__/item-supplier-persistence.test.ts`; no action, MCP, UI, schema, migration, or `src/lib/data.ts` facade change is included. |
| Work Unit 3 focused test command and exact result | `npm run test -- src/lib/__tests__/item-actions.test.ts src/lib/mcp/tools/__tests__/items.test.ts` — exit 0; 2 test files passed; 26 tests passed. |
| Work Unit 3 regression test command and exact result | `npm run test -- src/lib/__tests__/item-actions.test.ts src/lib/mcp/tools/__tests__/items.test.ts src/lib/__tests__/item-supplier-persistence.test.ts` — exit 0; 3 test files passed; 36 tests passed. `npx tsc --noEmit --pretty false --incremental false` — exit 0. |
| Work Unit 3 runtime harness command/scenario and exact result | N/A — existing Server Action and MCP in-memory transport unit harnesses exercise the adapter boundaries without a live service. |
| Work Unit 3 rollback boundary | Revert `src/app/dashboard/trips/[id]/actions.ts`, `src/lib/mcp/tools/items.ts`, and their focused tests; data-layer validation and all UI behavior remain independent. |

## Delivery

- Strategy: `auto-chain`
- Chain strategy: `feature-branch-chain`
- Work unit: PR 1 — Compatibility Contract
- PR boundary: pure typed compatibility module and focused unit tests only.
- Work unit: PR 2 — Trusted Item Persistence
- PR boundary: shared data-layer validation and explicit nullable supplier clearing in `src/lib/data/trips.ts` with focused persistence tests only.
- Work unit: PR 3 — Dashboard and MCP Adapters
- PR boundary: dashboard action nullable semantics plus MCP schema/error adapters and their focused tests only.
- Work unit: combined implementation boundary — Work Units 4 and 5
- Commit: `99ec183` (`fix(items): control supplier compatibility`)
- Provenance: the previously uncommitted Work Unit 4 source/test slice was necessarily included with Work Unit 5 integration in this commit; it is one rollback boundary, not a separate Work Unit 4 commit.
- Rollback file set: `src/components/SupplierCombobox.tsx`, `src/components/CreateSupplierDialog.tsx`, `src/components/CreateTravelAgentDialog.tsx`, `src/components/ItemFormDialog.tsx`, `src/components/__tests__/SupplierCombobox.test.ts`, and `e2e/mock/supplier-item-compatibility.spec.ts`. No public route, service, migration, or data-facade file changed.
- Corrective follow-up boundary: the final supplier keyboard fix changes `src/components/SupplierCombobox.tsx` and `e2e/mock/supplier-item-compatibility.spec.ts`; this file and `tasks.md` record its evidence. The same commit persists the pre-existing proposal, design, exploration, and delta-spec files; they do not change runtime behavior. Reverting the corrective source/test change leaves `99ec183` as the intact combined WU4/WU5 implementation boundary.

## Remaining Tasks

- [x] 4.1–4.4 Supplier Discovery Combobox
- [x] 5.1–5.3 Item Form State Integration
- [ ] 6.1–6.4 Full Verification and Handoff

## Work Unit 4 TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | `src/components/__tests__/SupplierCombobox.test.ts`, `e2e/mock/supplier-item-compatibility.spec.ts` | Component unit and Playwright mock runtime | No existing SupplierCombobox test suite existed. | Added category-filter and empty-query cases first; `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` failed with `TypeError: getSupplierOptions is not a function` (2 failed). | Focused component test passed: 1 file, 2 tests. After Work Unit 5 supplied the controlled caller, the safe supplier Playwright run passed 2 tests, including discovery and mapped quick-create. | Covers empty compatible catalog, accent-insensitive query, same-name incompatible supplier exclusion, and activity mapping. | Replaced the local supplier predicate with the typed component contract; added listbox semantics, keyboard navigation, bounded scrolling, and quick-create default propagation. |
| 4.2–4.4 | `src/components/__tests__/SupplierCombobox.test.ts`, `e2e/mock/supplier-item-compatibility.spec.ts` | Controlled combobox and quick-create UI | Focused component test passed before final typecheck. | The component helper was absent before implementation. | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests. `npx tsc --noEmit --pretty false --incremental false` — exit 0. Safe supplier Playwright run passed 2 tests. | The unit cases prove empty-query/full-catalog and normalized query paths; the route run proves the caller integration and activity default. | No UI dependency added; existing supplier management/quick-create remains available and edit mode retains the persisted supplier type. |

| Evidence | Observed result |
| --- | --- |
| Work Unit 4 focused component test command and exact result | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 test file, 2 tests passed. |
| Work Unit 4 narrow typecheck command and exact result | `npx tsc --noEmit --pretty false --incremental false` — exit 0. |
| Work Unit 4 runtime harness command/scenario and exact result | Historical default-port attempts failed before application assertions because Playwright reused `http://localhost:3000`, which served Forgejo; port 3001 was also occupied by Uptime Kuma. Those attempts were stopped without touching unrelated services. The final integrated route evidence is recorded below. |
| Work Unit 4 corrective runtime harness command and exact result | Repository config inspection confirmed no environment-based mock-port override. The first port-43127 attempt exited 1 because the activity form had no `supplierId` hidden input and exposed nested-form hydration. After the integrated caller/connected-dialog fix, `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier"` — exit 0; 2 tests passed in 4.9s on verified-free port 43127. The owned server was stopped; unrelated services were not touched. |
| Work Unit 4 rollback boundary | Revert the combined six-file implementation/test boundary listed in Delivery: `SupplierCombobox.tsx`, `CreateSupplierDialog.tsx`, `CreateTravelAgentDialog.tsx`, `ItemFormDialog.tsx`, `SupplierCombobox.test.ts`, and `supplier-item-compatibility.spec.ts`; keep the shared compatibility/data-layer work intact. |

## Work Unit 4 Status

- The combobox and quick-create component work is complete with focused component/type checks and integrated supplier-route evidence.
- Tasks 4.1–4.4 are checked off only after the final integrated supplier Playwright run passed; the route-level caller dependency was supplied by Work Unit 5.
- No separate Work Unit 4 commit exists: its previously uncommitted source/test slice is part of combined implementation commit `99ec183` with the six-file rollback boundary recorded above.

## Work Unit 5 TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.1 | `e2e/mock/supplier-item-compatibility.spec.ts` | Playwright mock runtime | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests passed. | The initial isolated run on verified-free port 43127 failed because the default activity form had no `supplierId` hidden input. | Route assertions passed after wiring: the final supplier E2E run passed 2 tests. | Covers hotel selection, title-only preservation, incompatible restaurant clearing, and supplier-free flight/note forms. | Assertions inspect the hidden submitted reference as well as visible combobox state. |
| 5.2 | `src/components/ItemFormDialog.tsx` | Client form state and Playwright mock runtime | Supplier combobox unit baseline passed before item-form edits. | The route RED established that the activity caller did not render a supplier hidden input. | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests. `npx tsc --noEmit --pretty false --incremental false` — exit 0. Final supplier E2E passed 2 tests. | Controlled selection is exercised across compatible hotel retention, incompatible restaurant clearing, supplier-free removal, and activity mapping. | Item type owns compatibility; supplier selection no longer rewrites item type; metadata autofill remains intact. |
| 5.3 | `src/components/SupplierCombobox.tsx`, `src/components/CreateSupplierDialog.tsx`, `src/components/CreateTravelAgentDialog.tsx`, `e2e/mock/supplier-item-compatibility.spec.ts` | Connected dialog/combobox integration | The first rerun reproduced the exact nested-form hydration failure in `CreateTravelAgentDialog` / `TravelAgentCombobox`. | The corrective same-session assertion failed after ArrowDown set `aria-activedescendant`: Enter selected the supplier but also submitted the outer item form and closed it. | The keypress guard now consumes Enter's form-submit default after keyboard selection. The focused unit and typecheck passed; the 45-second safe supplier E2E passed 2 tests. | The final route covers quick-create, same-session re-selection, category transitions, visible context, and keyboard reopening. | Kept quick-create as a native body-level modal, preserved combobox ARIA state, cleared controlled visible query on incompatible type changes, canceled stale blur timers, and prevented outer-form submission after Enter selection. |

## Work Unit 5 Runtime Evidence

| Evidence | Observed result |
| --- | --- |
| Safe runtime harness setup | Verified port 43127 was free. Created a temporary local Playwright config with `localhost:3000` replaced by `localhost:43127`; the owned `npm run dev -- --port 43127` server was stopped after checks. No unrelated service was touched. |
| RED runtime command and exact result | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier"` — exit 1. Before item-form wiring, the activity-form assertion failed because no `input[type="hidden"][name="supplierId"]` existed; the same run also exposed nested-form hydration in the dashboard. |
| Corrective runtime command and exact result | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier" --timeout=45000` — exit 0; 2 tests passed in 4.6s on verified-free port 43127. |
| Direct same-session quick-create evidence | The discovery test created `Same Session Tour Operator` as `tour_operator`, observed a non-empty hidden supplier id, then reselected it with ArrowDown/Enter and observed the same visible name and hidden id in the same item dialog session. |
| Work Unit 5 focused component command and exact result | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 test file, 2 tests passed. |
| Work Unit 5 typecheck command and exact result | `npx tsc --noEmit --pretty false --incremental false` — exit 0. |
| Work Unit 5 rollback boundary | The implementation commit is the combined WU4+WU5 six-file boundary listed in Delivery. The corrective runtime rollback is only `src/components/SupplierCombobox.tsx` and `e2e/mock/supplier-item-compatibility.spec.ts`; `tasks.md`, `apply-progress.md`, and the persisted planning artifacts are documentation only. Reverting the corrective source/test change restores the prior combined behavior. |

## Work Unit 5 Status

- Tasks 5.1–5.3 are complete on observed green evidence.
- Work Unit 5 implementation is recorded at combined commit `99ec183`; this corrective rerun adds the direct same-session evidence and reconciles the artifacts in one follow-up Conventional Commit. Phase 6 verification and archive remain out of scope.
- The temporary Playwright config is intentionally not part of the repository.

## Corrective Slice Terminal Result — 2026-09-28

Status: **complete for the corrective WU4/WU5 slice**. The focused supplier flow is green; Phase 6, archive, and PR work remain intentionally out of scope.

| Check | Exact command | Observed terminal result |
| --- | --- | --- |
| RED — focused same-session assertion | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "shows and selects" --timeout=45000` | **exit 1**. After ArrowDown set `aria-activedescendant`, Enter submitted the outer item form; the dialog-scoped supplier locator disappeared. |
| Focused component unit | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` | **exit 0**; 1 test file and 2 tests passed in 335ms. |
| Typecheck | `npx tsc --noEmit --pretty false --incremental false` | **exit 0**. |
| Safe supplier runtime harness | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier" --timeout=45000` | **exit 0**; 2 tests passed in 4.6s on verified-free port `43127`. No unrelated service was stopped or modified. |

The temporary `.playwright.issue-354-safe.config.ts` was removed after the green terminal result. Phase 6 verification, archive, and PR work remain out of scope.

## Corrective Phase 6 Reverification — 2026-09-28

- Focused unit: `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests passed.
- Typecheck: `npx tsc --noEmit` — exit 0.
- Targeted issue lint: `npx eslint src/components/CreateSupplierDialog.tsx src/components/CreateTravelAgentDialog.tsx src/components/ItemFormDialog.tsx src/components/SupplierCombobox.tsx` — exit 0.
- Full lint: `npm run lint` — exit 1 from pre-existing `src/app/layout.tsx:46`; the four issue-354 React errors are resolved.
- Safe E2E: temporary Playwright config on verified-free port 43127 was removed; the supplier suite remains red (same-session quick-create/reselection unmounts the item dialog; stale-selection scenario passes). No commit was made because the E2E acceptance gate is not green.

## Supplier Dialog Unmount Correction — 2026-09-28

The remaining unmount came from React synthetic event bubbling across the body-level portal: submitting `CreateSupplierDialog` also reached the logical parent `ItemFormDialog` form. The parent then ran its item-submit path and closed the native item dialog. `CreateSupplierDialog` now stops propagation after preventing the create-form submit default, preserving the nested portal and in-memory created-supplier catalog.

| Check | Exact command | Observed terminal result |
| --- | --- | --- |
| RED — explicit dialog-survival assertion | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier" --timeout=45000` | **exit 1** before the correction; the new `await expect(itemDialog).toBeVisible()` assertion failed after ArrowDown/Enter, while the stale-selection scenario passed. |
| Focused component unit | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` | **exit 0**; 1 file, 2 tests passed in 338ms. |
| Typecheck | `npx tsc --noEmit` | **exit 0**. |
| Targeted issue lint | `npx eslint src/components/CreateSupplierDialog.tsx src/components/CreateTravelAgentDialog.tsx src/components/ItemFormDialog.tsx src/components/SupplierCombobox.tsx` | **exit 0**. |
| Full lint | `npm run lint` | **exit 1** only for pre-existing `src/app/layout.tsx:46` `@next/next/no-sync-scripts`; 11 unrelated warnings were also reported. |
| Safe supplier runtime harness | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier" --timeout=45000` | **exit 0**; 2 tests passed in 4.3s using an owned `localhost:43127` server after verifying the port was free. |

The temporary `.playwright.issue-354-safe.config.ts` was removed after verification. The corrective commit `c58dd6b` contains the complete runtime/test correction boundary: `src/components/CreateSupplierDialog.tsx`, `src/components/CreateTravelAgentDialog.tsx`, `src/components/ItemFormDialog.tsx`, `src/components/SupplierCombobox.tsx`, and `e2e/mock/supplier-item-compatibility.spec.ts`. Its documentation-only files are `openspec/changes/issue-354/apply-progress.md` and `openspec/changes/issue-354/verify-report.md`. Reverting those five runtime/test paths restores `2526ed2`; reverting `2526ed2` restores the combined `99ec183` WU4/WU5 implementation boundary. No public route, service, migration, or supplier catalog contract changed.

## Corrective Commit Provenance — `c58dd6b`

- Purpose: isolate quick-create submit events from the logical parent item form and preserve same-session supplier reselection.
- Runtime/test paths changed: `src/components/CreateSupplierDialog.tsx`, `src/components/CreateTravelAgentDialog.tsx`, `src/components/ItemFormDialog.tsx`, `src/components/SupplierCombobox.tsx`, and `e2e/mock/supplier-item-compatibility.spec.ts`.
- Documentation paths changed: `openspec/changes/issue-354/apply-progress.md` and `openspec/changes/issue-354/verify-report.md`.
- Rollback: revert the five runtime/test paths above; retain the prior combined WU4/WU5 implementation at `2526ed2`.

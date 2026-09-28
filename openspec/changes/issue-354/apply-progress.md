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

## Remaining Tasks

- [ ] 4.1–4.4 Supplier Discovery Combobox
- [x] 5.1–5.3 Item Form State Integration
- [ ] 6.1–6.4 Full Verification and Handoff

## Work Unit 4 In-Progress Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4.1 | `src/components/__tests__/SupplierCombobox.test.ts`, `e2e/mock/supplier-item-compatibility.spec.ts` | Component unit and Playwright mock runtime | No existing SupplierCombobox test suite existed. | Added category-filter and empty-query cases first; `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` failed with `TypeError: getSupplierOptions is not a function` (2 failed). | The focused component test now passes: 1 file, 2 tests. The Playwright scenario is present but has not produced a valid app-runtime result because the configured port is occupied by unrelated local services. | Covers empty compatible catalog, accent-insensitive query, and same-name incompatible supplier exclusion. | Replaced the local supplier predicate with the typed component contract; added listbox semantics, keyboard navigation, bounded scrolling, and quick-create default propagation. |
| 4.2–4.4 | `src/components/__tests__/SupplierCombobox.test.ts`, `e2e/mock/supplier-item-compatibility.spec.ts` | Controlled combobox and quick-create UI | Focused component test passed before final typecheck. | The component helper was absent before implementation. | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests. `npx tsc --noEmit --pretty false --incremental false` — exit 0. | The unit cases prove both empty-query/full-catalog and normalized query paths. | No UI dependency added; existing supplier management/quick-create remains available and edit mode retains the persisted supplier type. |

| Evidence | Observed result |
| --- | --- |
| Work Unit 4 focused component test command and exact result | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 test file, 2 tests passed. |
| Work Unit 4 narrow typecheck command and exact result | `npx tsc --noEmit --pretty false --incremental false` — exit 0. |
| Work Unit 4 runtime harness command/scenario and exact result | `npm run test:e2e -- --grep "supplier"` — failed before application assertions because Playwright reused `http://localhost:3000`, which served Forgejo rather than TravelHub. An isolated retry on port 3001 also failed before application assertions when that port was occupied by Uptime Kuma; the test timed out waiting for the TravelHub draft control. The hanging attempt was stopped; no runtime pass is claimed. |
| Work Unit 4 corrective runtime harness command and exact result | Repository config inspection confirmed no environment-based mock-port override. Using Playwright's documented temporary `--config` override with a verified-free port 43127 reached TravelHub: `npx playwright test --config=/tmp/travelhub-issue-354-safe.playwright.config.ts --grep "supplier"` — exit 1; 1 test failed because the activity form had no supplier hidden input. The owned server was stopped; unrelated services were not touched. |
| Work Unit 4 rollback boundary | Revert `src/components/SupplierCombobox.tsx`, `src/components/CreateSupplierDialog.tsx`, `src/components/__tests__/SupplierCombobox.test.ts`, and `e2e/mock/supplier-item-compatibility.spec.ts`; keep the shared compatibility/data-layer work intact. |

## Work Unit 4 Status

- The combobox and quick-create component work is implemented with focused component/type checks complete; ItemFormDialog integration remains deferred to Work Unit 5 as required by task scope.
- Tasks 4.1–4.4 remain unchecked: the safe rerun reached TravelHub but failed at the Work Unit 5 route-level caller dependency. Task 4.4's focused runtime acceptance cannot be claimed until that controlled caller exists.
- No Work Unit 4 commit was created because the required runtime evidence is blocked.

## Work Unit 5 TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5.1 | `e2e/mock/supplier-item-compatibility.spec.ts` | Playwright mock runtime | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests passed. | The initial isolated run on verified-free port 43127 failed because the default activity form had no `supplierId` hidden input. | Route assertions passed after wiring: the final supplier E2E run passed 2 tests. | Covers hotel selection, title-only preservation, incompatible restaurant clearing, and supplier-free flight/note forms. | Assertions inspect the hidden submitted reference as well as visible combobox state. |
| 5.2 | `src/components/ItemFormDialog.tsx` | Client form state and Playwright mock runtime | Supplier combobox unit baseline passed before item-form edits. | The route RED established that the activity caller did not render a supplier hidden input. | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 file, 2 tests. `npx tsc --noEmit --pretty false --incremental false` — exit 0. Final supplier E2E passed 2 tests. | Controlled selection is exercised across compatible hotel retention, incompatible restaurant clearing, supplier-free removal, and activity mapping. | Item type owns compatibility; supplier selection no longer rewrites item type; metadata autofill remains intact. |
| 5.3 | `src/components/SupplierCombobox.tsx`, `src/components/CreateSupplierDialog.tsx`, `src/components/CreateTravelAgentDialog.tsx` | Connected dialog/combobox integration | The first rerun reproduced the exact nested-form hydration failure in `CreateTravelAgentDialog` / `TravelAgentCombobox`. | Existing route RED plus the hydration failure constrained the portal correction. | Final supplier E2E passed 2 tests; focused unit and typecheck remained green. | The final route covers quick-create, category transitions, visible context, and keyboard reopening. | Portaled nested dialogs out of outer forms; synchronized portal mount before `showModal`; cleared controlled visible query on incompatible type changes; canceled stale blur timers; made quick-create activation reliable. |

## Work Unit 5 Runtime Evidence

| Evidence | Observed result |
| --- | --- |
| Safe runtime harness setup | Verified port 43127 was free. Created a temporary local Playwright config with `localhost:3000` replaced by `localhost:43127`; the owned `npm run dev -- --port 43127` server was stopped after checks. No unrelated service was touched. |
| RED runtime command and exact result | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier"` — exit 1. Before item-form wiring, the activity-form assertion failed because no `input[type="hidden"][name="supplierId"]` existed; the same run also exposed nested-form hydration in the dashboard. |
| Corrective runtime command and exact result | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier"` — exit 0; 2 tests passed in 4.3s on verified-free port 43127. |
| Work Unit 5 focused component command and exact result | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` — exit 0; 1 test file, 2 tests passed. |
| Work Unit 5 typecheck command and exact result | `npx tsc --noEmit --pretty false --incremental false` — exit 0. |
| Work Unit 5 rollback boundary | Revert `src/components/ItemFormDialog.tsx`, `src/components/CreateSupplierDialog.tsx`, and the Work Unit 5 additions in `e2e/mock/supplier-item-compatibility.spec.ts`; retain Work Units 1–4. |

## Work Unit 5 Status

- Tasks 5.1–5.3 are complete on observed green evidence.
- Work Unit 5 is ready for its required work-unit commit; Phase 6 verification and archive remain out of scope.
- The temporary Playwright config is intentionally not part of the repository.

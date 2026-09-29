# Verification Report: issue-354

**Date:** 2026-09-28
**Status:** Partial
**Mode:** Strict TDD
**Scope:** Proposal, three delta specs, design, tasks, apply progress, issue implementation, and tests were inspected. Verification did not modify source behavior or task scope.

## Executive Summary

The compatibility domain, persistence, dashboard action, MCP, and focused unit tests are green, and typecheck and production build pass. The change is not ready for a clean verification handoff: the supplier Playwright suite reproducibly fails after same-session quick creation and keyboard reselection, and lint reports four errors in issue-354 files. The complete unit suite also has one failure outside the issue-354 diff.

## Configured Checks

Checks were executed in the required order.

| Check | Result | Observed terminal outcome |
| --- | --- | --- |
| `npm run test` | **FAIL** | Exit 1. 100 files passed and 1 failed; 702 tests passed and 1 failed. `src/app/client/login/__tests__/page.test.tsx:54` expected `Acceso para clientes`, but current rendered copy does not contain it. The failing file is outside the issue-354 diff. |
| `npm run test:e2e -- --grep "supplier"` with temporary safe config on verified-free port 43127 | **FAIL** | Exit 1. 1 test passed and 1 failed. `supplier-item-compatibility.spec.ts:48` could no longer locate the open item dialog after Enter during same-session supplier reselection. Port 3000 was occupied by an unrelated OrbStack process and was not touched. The temporary config changed the base URL and owned dev-server port to 43127 and was removed afterward. |
| `npx tsc --noEmit` | **PASS** | Exit 0 with no diagnostics. |
| `npm run lint` | **FAIL** | Exit 1 with 5 errors and 10 warnings. Four errors are in issue-354 files: `CreateSupplierDialog.tsx:48`, `CreateTravelAgentDialog.tsx:39`, and `SupplierCombobox.tsx:69,77` (`react-hooks/set-state-in-effect`). One error in `src/app/layout.tsx:46` and all reported warnings are outside the issue-354 diff. |
| `npm run build` | **PASS** | Exit 0. Next.js 16.3.4 compiled, typechecked, collected data, and generated 27 static pages. It emitted the existing middleware-to-proxy deprecation warning. The build-generated `next-env.d.ts` change was restored to the committed content. |

Additional diagnostics:

| Check | Result | Observed terminal outcome |
| --- | --- | --- |
| Focused Vitest files for compatibility, persistence, actions, MCP, and supplier filtering | **PASS** | Exit 0; 5 files and 41 tests passed. |
| Supplier E2E repeat with `--timeout=45000` on port 43127 | **FAIL** | Exit 1 with the same line-48 failure; 1 test passed and 1 failed. The repeat confirms the failure is reproducible, not a single timeout artifact. |

## Findings

### Critical

1. **Same-session keyboard reselection closes the item dialog.** After quick-creating `Same Session Tour Operator`, ArrowDown sets `aria-activedescendant`, but Enter causes the open `Agregar item` dialog to disappear before the selected supplier value can be asserted. Both required E2E executions failed at `e2e/mock/supplier-item-compatibility.spec.ts:48`. This contradicts the historical green result recorded in apply progress and leaves the Work Unit 4/5 keyboard acceptance unresolved.

### Warnings

1. **Issue-354 does not pass lint.** Four `react-hooks/set-state-in-effect` errors are introduced in changed files. These are verification failures even though typecheck and build pass.
2. **The complete unit suite is not green.** The single `/client/login` copy assertion failure is outside the issue-354 diff, but the configured `npm run test` gate still exits non-zero.
3. **Historical apply evidence is stale for current HEAD.** Apply progress records two passing supplier E2E tests after the keyboard correction; current HEAD `2526ed2` fails the same scenario twice under the documented safe-port harness.

## Scope and Architecture Reconciliation

- The implementation centralizes the mapping in `src/lib/item-supplier-compatibility.ts` and consumes it from UI and trusted persistence code.
- `createItem` and `updateItem` validate supplier existence, active status, and resulting type compatibility before mock or Supabase mutation; explicit `null` clears and `undefined` preserves the relation.
- Dashboard and MCP layers remain adapters. MCP accepts nullable update input and exposes only the known compatibility error while sanitizing unknown errors.
- `ItemFormDialog` makes item type authoritative and controls supplier state; `SupplierCombobox` filters the preloaded catalog, supports normalized search, quick creation, and native combobox semantics.
- Diff inspection from merge base `788431488191babd66693db77fd84eb1b960069b` through HEAD found **no changes** under `supabase/migrations`, `src/app/t/[slug]`, or `src/lib/data.ts`.
- No new public supplier query or database migration was added.

## Delta Scenario Reconciliation

| Capability / scenario | Evidence | Result |
| --- | --- | --- |
| MCP add compatible supplier | MCP adapter test plus persistence tests | Covered; focused tests pass. |
| MCP add supplier-free item | MCP flight case plus persistence table cases | Covered; focused tests pass. |
| MCP reject incompatible supplier | Known-error mapping test plus pre-mutation persistence assertions | Covered; focused tests pass. |
| MCP reject unsupported type | Zod schema test | Covered; focused tests pass. |
| MCP compatible update | MCP adapter and resulting-state persistence tests | Covered; focused tests pass. |
| MCP reject incompatible resulting update | MCP known-error case plus unchanged-state persistence assertions | Covered; focused tests pass. |
| MCP reject supplier on flight/note | MCP supplier-free rejection plus domain/persistence cases | Covered; focused tests pass. |
| MCP missing item | Existing `NOT_FOUND: item <id>` test | Covered; focused tests pass. |
| Attach compatible supplier | Persistence tests and supplier E2E selection | Unit evidence passes; E2E file later fails. |
| Do not offer incompatible suppliers | Supplier option unit test and E2E listbox assertions | Assertions are implemented; required E2E file is not green. |
| Supplier context remains visible | Static implementation renders selected supplier address/contact context | Statically satisfied; no dedicated passing runtime assertion. |
| Empty focus shows all compatible suppliers | Supplier option unit test and E2E count/content assertions | Unit evidence passes; required E2E file is not green. |
| Typed search stays compatible | Supplier option unit test and E2E typed-filter assertions | Unit evidence passes; required E2E file is not green. |
| Accent-insensitive search | `Hotel Águila` / `aguila` unit case | Covered; focused test passes. |
| Quick creation inherits mapping | E2E asserts `tour_operator` default before the later failure | Assertion is reached, but the containing required E2E test does not complete. |
| Generate missing days | Existing trip-day behavior remains outside this delta's code changes | No regression indicated by issue-focused checks; full suite is not wholly green. |
| Reject invalid structured metadata | Existing `structured-items` and action tests remain present | Covered by existing tests; full suite is not wholly green. |
| Clear stale supplier after category change | Second supplier E2E scenario | Covered; that scenario passes. |
| Preserve valid supplier selection | Second supplier E2E scenario | Covered; that scenario passes. |
| Supplier-free flight/note remains valid | Persistence tests and second supplier E2E scenario | Covered; focused unit and E2E scenario pass. |
| Trusted write rejects incompatible pair atomically | Mock and mocked-Supabase persistence assertions | Covered; focused tests pass. |

Every delta scenario has implementation or test evidence, but the discovery/quick-create keyboard path cannot be accepted because its required E2E test fails reproducibly.

## Strict TDD Review

### TDD Compliance

| Check | Result | Details |
| --- | --- | --- |
| TDD evidence reported | **PASS** | Apply progress contains RED, GREEN, triangulation, safety-net, and refactor evidence for Work Units 1–5. |
| Referenced test files exist | **PASS** | All compatibility, persistence, action, MCP, component, and Playwright files referenced by apply progress exist. |
| Historical RED confirmed | **LIMITED** | Historical failures are documented but were not replayed; verification confirms file existence and current behavior only. |
| Current GREEN confirmed | **FAIL** | Five focused Vitest files pass 41 tests, but the required supplier E2E suite fails 1 of 2 tests twice. |
| Triangulation | **PASS** | Mapping, supplier-free, invalid, nullable, missing, adapter, discovery, and category-transition cases use varied inputs and outcomes. |
| Safety net | **PASS WITH LIMITATION** | Apply progress records baseline checks; current complete suite has one unrelated failure. |

**TDD compliance:** Historical cycle evidence is present, but current GREEN is not established for the complete change.

### Test Layer Distribution

| Layer | Tests | Files | Tooling |
| --- | ---: | ---: | --- |
| Unit / adapter | 41 | 5 | Vitest, mocked persistence, MCP in-memory transport |
| E2E | 2 | 1 | Playwright mock project |
| **Total** | **43** | **6** | |

### Assertion Quality

No tautologies, ghost loops, assertion-free production paths, smoke-only component tests, or implementation-detail CSS assertions were found in the six changed test files. The two empty-array assertions in the persistence test verify rejected writes produced no insert/update calls and have companion successful mutation cases.

**Assertion quality:** No critical or warning-level trivial assertions found.

### Changed File Coverage

Coverage analysis was skipped because no Vitest coverage provider is installed. The configured threshold is `0`; missing coverage tooling is informational, not a failure.

### Quality Metrics

- **Type checker:** PASS.
- **Linter:** FAIL — four issue-354 errors and one unrelated error; ten unrelated warnings.
- **Build:** PASS with middleware deprecation warning.

## Phase 6 Task-State Recommendation

Do not edit the existing task checkboxes during verification. Recommended state:

- **6.1 remains unchecked:** focused Vitest evidence is green, but the supplier E2E work-unit command is red.
- **6.2 may be checked:** all five configured commands were executed in order and every result is recorded truthfully, including failures.
- **6.3 remains unchecked:** scope exclusions are confirmed and scenarios are mapped, but the keyboard/quick-create scenario and issue-specific lint errors remain unresolved.
- **6.4 remains unchecked:** chain strategy and rollback boundaries are documented, but the planned five PR boundaries were not preserved as five independent implementation commits; Work Units 4 and 5 are combined.

## Recommendation

Return to `sdd-apply` for a bounded correction of the reproducible keyboard reselection failure and the four lint errors in changed files, then rerun Phase 6. Archive may record a partial verification, but PR creation should not represent this change as fully verified.

## Corrective Reverification — 2026-09-28

**Status: blocked.** The four issue-354 React lint errors were corrected in `CreateSupplierDialog.tsx`, `CreateTravelAgentDialog.tsx`, and `SupplierCombobox.tsx`; targeted lint for those four issue files exits 0. `npx tsc --noEmit` and `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` also exit 0 (1 file, 2 tests).

The safe, temporary Playwright configuration used a verified-free `127.0.0.1:43127` and was removed after each run. The supplier E2E remains non-terminal: the first scenario still unmounts the item dialog after quick-create and same-session keyboard reselection, while the second stale-selection scenario passes. Browser instrumentation observed no `submit` or `close` event on the item form/dialog before the unmount, indicating the failure is not the combobox Enter default action alone. No corrective commit was created because the required E2E is not green.

`npm run lint` remains exit 1 solely because of the pre-existing `src/app/layout.tsx:46` `@next/next/no-sync-scripts` error; it reports 10 unrelated warnings. The issue-specific four React errors are no longer reported.

Full `npm run test` and `npm run build` were not rerun in this corrective pass; the user requested focused unit, safe supplier E2E, typecheck, and lint, and prior verification already recorded build green. The known unrelated login-copy failure was therefore not re-observed in this pass.

## Supplier Dialog Unmount Correction — 2026-09-28

**Status: issue-scope checks pass.** The supplier quick-create form is rendered in a body-level portal but remains a logical React descendant of the item form. Its submit event therefore propagated through React to `ItemFormDialog`, invoking the parent item-submit/close path even though browser-level instrumentation did not observe a native parent form submit or dialog close. `CreateSupplierDialog` now calls `stopPropagation()` after `preventDefault()`, which confines the create action to its own form.

The route-level regression now explicitly asserts that the original item dialog remains visible after same-session ArrowDown/Enter reselection of the quick-created supplier. It preserves the selected supplier name and hidden ID.

| Check | Result | Observed terminal outcome |
| --- | --- | --- |
| Focused SupplierCombobox unit | **PASS** | `npm run test -- src/components/__tests__/SupplierCombobox.test.ts` exited 0; 1 file, 2 tests passed in 338ms. |
| Safe supplier E2E | **PASS** | `npx playwright test --config=.playwright.issue-354-safe.config.ts --grep "supplier" --timeout=45000` exited 0; 2 tests passed in 4.3s on verified-free `localhost:43127`. |
| Typecheck | **PASS** | `npx tsc --noEmit` exited 0. |
| Targeted issue lint | **PASS** | `npx eslint src/components/CreateSupplierDialog.tsx src/components/CreateTravelAgentDialog.tsx src/components/ItemFormDialog.tsx src/components/SupplierCombobox.tsx` exited 0. |
| Full lint | **PARTIAL** | `npm run lint` still exits 1 solely for pre-existing `src/app/layout.tsx:46` `@next/next/no-sync-scripts`; it also reports 11 unrelated warnings. No issue-354 lint errors remain. |

The temporary safe Playwright config was deleted after its terminal run. Full unit and build were intentionally not rerun in this correction; their prior out-of-scope status remains unchanged. This correction is ready for its requested corrective commit; archive and PR remain out of scope.

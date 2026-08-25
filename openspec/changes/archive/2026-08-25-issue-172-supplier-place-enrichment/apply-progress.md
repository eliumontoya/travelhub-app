# Apply Progress: Supplier Place Enrichment (issue #172)

## Mode

Strict TDD (per `openspec/config.yaml`).

## Completed Tasks

- [x] 1.1 Add RED data-layer test for confirmed enrichment partial update preserving unrelated supplier fields.
- [x] 1.2 Add RED UI tests for enrichment review/cancel affordances and missing-key fallback.
- [x] 1.3 Extract shared Google Places script loading/types for autocomplete and enrichment search reuse.
- [x] 2.1 Add `SupplierPlaceEnrichmentDialog` with query construction, candidate search, empty/error states, candidate selection, and comparison review.
- [x] 2.2 Add per-row “Completar desde Google” action in supplier catalog and refresh after confirmed save.
- [x] 2.3 Preserve manual edit fallback and ensure cancellation makes no update call.
- [x] 3.1 Run focused unit tests for data and enrichment UI.
- [x] 3.2 Run `npm run test`.
- [x] 3.3 Run `npm run build`.

## TDD Evidence

| Cycle | RED | GREEN / REFACTOR |
|---|---|---|
| Data enrichment | Added partial-update preservation test for confirmed Google fields. | Existing `updateSupplier` partial patch behavior passed and documents the acceptance path. |
| UI enrichment | Added tests importing missing `SupplierPlaceEnrichmentDialog`; focused run failed because the component did not exist. | Implemented dialog and shared Places helper exports; focused tests passed `2 files / 22 tests`. |
| Lint remediation | `npm run lint` failed on synchronous state updates in an effect. | Removed prop-mirroring state effect and relied on keyed dialog initial state; lint passed with one pre-existing warning. |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/components/SupplierPlaceEnrichmentDialog.tsx` | Created | Adds Places Text Search, candidate list, current-vs-found comparison, explicit confirm update, and graceful empty/error/missing-key states. |
| `src/components/SupplierPlaceAutocomplete.tsx` | Modified | Exports shared Google Places loader/types and formatting helpers for reuse. |
| `src/app/dashboard/suppliers/catalog-client.tsx` | Modified | Adds per-row enrichment action and dialog lifecycle with refresh after update. |
| `src/components/__tests__/SupplierPlaceEnrichmentDialog.test.tsx` | Created | Covers comparison/confirm affordances and missing-key manual fallback. |
| `src/lib/__tests__/data.test.ts` | Modified | Adds confirmed enrichment partial-update preservation regression. |
| `openspec/changes/issue-172-supplier-place-enrichment/*` | Created/Updated | Proposal, delta spec, design, tasks, state, apply progress, and verification report. |

## Deviations from Design

None — implementation matches design.

## Work Unit Evidence

| Evidence | Required value |
|---|---|
| Focused test command and exact result | `npm run test -- src/lib/__tests__/data.test.ts src/components/__tests__/SupplierPlaceEnrichmentDialog.test.tsx` → exit 0, 2 files passed, 22 tests passed |
| Runtime harness command/scenario and exact result | `npm run test` → exit 0, 22 files passed, 121 tests passed; `npm run build` → exit 0, production build compiled successfully |
| Rollback boundary | Revert supplier enrichment component, catalog action wiring, shared Places exports, tests, and active SDD change folder. |

## Status

9/9 tasks complete. Ready for PR and manual verification.

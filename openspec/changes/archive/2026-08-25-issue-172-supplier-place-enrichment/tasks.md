# Tasks: Supplier Place Enrichment (issue #172)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 250-380 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Decision needed before apply | No |
| Delivery strategy | single PR |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Medium

## Phase 1: Tests and shared Places helper

- [x] 1.1 Add RED data-layer test for confirmed enrichment partial update preserving unrelated supplier fields.
- [x] 1.2 Add RED UI tests for enrichment review/cancel affordances and missing-key fallback.
- [x] 1.3 Extract shared Google Places script loading/types for autocomplete and enrichment search reuse.

## Phase 2: Enrichment UI

- [x] 2.1 Add `SupplierPlaceEnrichmentDialog` with query construction, candidate search, empty/error states, candidate selection, and comparison review.
- [x] 2.2 Add per-row “Completar desde Google” action in supplier catalog and refresh after confirmed save.
- [x] 2.3 Preserve manual edit fallback and ensure cancellation makes no update call.

## Phase 3: Verification

- [x] 3.1 Run focused unit tests for data and enrichment UI.
- [x] 3.2 Run `npm run test`.
- [x] 3.3 Run `npm run build`.

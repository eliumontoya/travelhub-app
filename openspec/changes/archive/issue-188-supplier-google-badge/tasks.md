# Tasks: Supplier Google Badge (issue #188)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 80-140 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Decision needed before apply | No |
| Delivery strategy | single PR |

Decision needed before apply: No
Chained PRs recommended: No
400-line budget risk: Low

## Phase 1: Tests

- [x] 1.1 Add RED tests for rendering the badge when `googlePlaceId` exists.
- [x] 1.2 Add RED tests for rendering nothing when `googlePlaceId` is absent or blank.

## Phase 2: Implementation

- [x] 2.1 Add an accessible presentational Google Places badge component.
- [x] 2.2 Render the badge next to supplier names in `/dashboard/suppliers`.

## Phase 3: Verification and archive

- [x] 3.1 Run focused unit test.
- [x] 3.2 Run `npx tsc --noEmit`.
- [x] 3.3 Run `npm test`.
- [x] 3.4 Run `npm run build`.
- [x] 3.5 Archive OpenSpec artifacts and open PR.

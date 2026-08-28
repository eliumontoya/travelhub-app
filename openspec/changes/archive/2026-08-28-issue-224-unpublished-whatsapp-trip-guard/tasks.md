# Tasks: Unpublished WhatsApp Trip Guard

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-220 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

## Implementation

- [x] 1.1 Add failing unit coverage for non-published trip summary guard.
- [x] 1.2 Add failing unit coverage for non-published itinerary/document guards and active-trip choice minimization.
- [x] 2.1 Implement shared publication guard for trip-scoped tools.
- [x] 2.2 Sanitize non-published active trip choices.
- [x] 3.1 Run focused unit tests.
- [x] 3.2 Run typecheck, lint, and build verification.

## Rollback Boundary

Revert `src/lib/ai/tools/travelhub-client-tools.ts`, `src/lib/ai/__tests__/travelhub-client-tools.test.ts`, and this change's OpenSpec artifacts.

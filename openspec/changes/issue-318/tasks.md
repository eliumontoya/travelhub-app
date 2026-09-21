# Tasks: Prevent Orphaned Service-Document Storage Objects

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120–180 authored lines (focused Supabase test double/assertions plus local compensation branch) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR / one work unit |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Add bounded provisional-object compensation and Supabase-mode regression coverage for service-document uploads | PR 1 | `npx vitest run src/lib/data/__tests__/services.test.ts` | N/A — the change is a deterministic data-layer failure/ordering contract with no UI, route, or external runtime harness | Revert the changes to `src/lib/data/services.ts` and `src/lib/data/__tests__/services.test.ts` together; no schema or persisted-data rollback is required |

## Phase 1: RED — Supabase Failure and Ordering Tests

- [x] 1.1 Extend `src/lib/data/__tests__/services.test.ts` with a focused Supabase client double that models the checklist-item lookup, existing-upload lookup, Storage `upload`, `service_uploads` `upsert`, and Storage `remove` calls while recording exact paths and event order.
- [x] 1.2 Add a failing first-upload persistence test: after Storage upload succeeds and the `service_uploads` upsert returns a persistence error, assert that compensation calls `remove([P2])` exactly once, never reports a successful `ServiceUpload`, and rethrows the original persistence error when cleanup succeeds.
- [x] 1.3 Add a failing replacement persistence test: seed an existing row at P1, fail the replacement upsert after uploading P2, assert that only P2 is removed, P1 is never a compensation target, and the operation rejects while the existing row remains represented by P1.
- [x] 1.4 Add failing cleanup-failure tests for both Storage `remove` result errors and thrown/rejected removal calls; assert `AggregateError`, causal order `[persistenceError, cleanupError]`, and semantic diagnostics naming incomplete cleanup, orphan risk, and P2 without freezing incidental wording.
- [x] 1.5 Add a failing successful-replacement ordering test: assert the upsert event completes before `remove([P1])`, no provisional compensation occurs, and the returned row references P2. Run the focused test command and record the expected RED failure before production changes.

## Phase 2: GREEN — Provisional Storage Compensation

- [x] 2.1 Update `src/lib/data/services.ts` in `uploadServiceDocument` so the newly uploaded path remains provisional until `service_uploads` upsert succeeds; on persistence failure, attempt one `remove([path])` call and never target `oldPath` in that branch.
- [x] 2.2 Preserve the original persistence error when compensating removal succeeds; when removal returns `{ error }` or throws/rejects, reject with `AggregateError([persistenceError, cleanupFailure])` whose message explicitly states that cleanup is incomplete and the provisional path may remain orphaned. Keep the existing `upload → upsert → remove old path` success ordering and return contract unchanged.
- [x] 2.3 Run `npx vitest run src/lib/data/__tests__/services.test.ts` and then `npm run test`; all focused RED cases must be GREEN and the existing suite must remain passing.

## Phase 3: REFACTOR — Contract and Type Safety Verification

- [x] 3.1 Simplify the focused Supabase test double and assertions so they prove exact compensation targets, causal error retention, and event ordering without duplicating unrelated Supabase client internals; retain deterministic path capture rather than wall-clock assertions.
- [x] 3.2 Re-run `npx vitest run src/lib/data/__tests__/services.test.ts`, `npm run test`, and `npx tsc --noEmit`; record results and confirm no UI, route, schema, migration, or unrelated upload-flow files changed.

## Threat Matrix Coverage

- No threat-matrix tasks are required. The design marks all rows `N/A` because this change has no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

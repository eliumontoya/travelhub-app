# Tasks: Data Layer Domain Boundaries

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 2,900-3,700 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Single PR under approved `size:exception` for #269 epic closure |
| Delivery strategy | exception-ok |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Contract tests pin facade/domain behavior | PR 1 | `npm run test -- src/lib/__tests__/data-domain-contracts.test.ts` | N/A — data-layer unit contract | Remove test file only |
| 2 | Extract domain modules and facade | PR 1 | same focused Vitest command | N/A — import/type boundary | Revert `src/lib/data.ts` and `src/lib/data/` |
| 3 | Verify and archive SDD evidence | PR 1 | `npx tsc --noEmit`, `npm run lint`, `npm run build` | N/A — no route/UX change | Revert OpenSpec archive/spec artifacts |

## Phase 1: Contract Tests

- [x] 1.1 Add `src/lib/__tests__/data-domain-contracts.test.ts` importing through `@/lib/data` and direct domain paths before modules exist.
- [x] 1.2 Cover mock client/tag create/list/tag-assignment behavior and facade export compatibility.
- [x] 1.3 Cover representative trip/detail and document/storage mock contracts.

## Phase 2: Domain Extraction

- [x] 2.1 Create `src/lib/data/shared.ts` with shared pagination, id, mock/Supabase helpers, and common mappers.
- [x] 2.2 Move client/tag code to `src/lib/data/clients.ts` without changing behavior.
- [x] 2.3 Move supplier supporting code to `src/lib/data/suppliers.ts` without changing behavior.
- [x] 2.4 Move trip, itinerary, packing, and reminder code to `src/lib/data/trips.ts` without changing behavior.
- [x] 2.5 Move documents, storage, photos, covers, and logo upload code to `src/lib/data/documents.ts` without changing behavior.
- [x] 2.6 Move dashboard stats, settings, and feedback code to small support modules.
- [x] 2.7 Replace `src/lib/data.ts` with compatibility re-exports.

## Phase 3: Verification Evidence

- [x] 3.1 Run focused contract tests until green and record RED/GREEN/REFACTOR evidence.
- [x] 3.2 Run typecheck, lint, and practical build/test verification.
- [x] 3.3 Persist apply-progress and verify-report artifacts with no schema-change note.

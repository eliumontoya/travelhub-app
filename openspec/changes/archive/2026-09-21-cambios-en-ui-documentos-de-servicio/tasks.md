# Tasks: Service Document UI Changes

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 850–1100 lines |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 data/actions; PR 2 public callout; PR 3 dashboard UI; PR 4 E2E and verification |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Secure data contracts and actions | PR 1 | `npm run test -- src/lib/data/__tests__/services.test.ts src/app/dashboard/trips/[id]/__tests__/actions.test.ts` | N/A: server contracts are covered by Vitest | Types, services, and actions |
| 2 | Ownership-safe public callout | PR 2 | `npm run test -- src/app/t/[slug]/__tests__/page.test.tsx` | N/A: server-rendered route test | Public page and route tests |
| 3 | Summary dashboard and modal | PR 3 | `npm run test -- src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` | N/A: component behavior is covered by Vitest | Dashboard page, manager, and component test |
| 4 | Browser proof and spec verification | PR 4 | `npm run test:e2e -- e2e/service-documents.spec.ts` | Playwright: published trip, modal, review, bulk assignment | E2E spec and verification-only changes |

Feature-branch-chain recommendation: PR #1 targets the tracker branch; later PRs target the immediately previous PR branch.

## Phase 1: Data and action boundary (PR 1)

- [x] 1.1 RED: Extend `src/lib/data/__tests__/services.test.ts` and create `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` for counts, scoping, atomic zero-write validation, lifecycle, and upload review/storage transitions.
- [x] 1.2 GREEN: Add `ServiceDocumentSummary` in `src/types/index.ts`, summary/ownership/detail/bulk APIs in `src/lib/data/services.ts`, and guarded detail/bulk actions in `src/app/dashboard/trips/[id]/actions.ts` with mock/Supabase parity and revalidation.
- [x] 1.3 REFACTOR: Keep lifecycle authorization independent from itinerary editability and preserve client-only status transitions; run focused tests.

## Phase 2: Public traveler callout (PR 2)

- [x] 2.1 RED: Create `src/app/t/[slug]/__tests__/page.test.tsx` for eligible, anonymous, unassigned, and zero-requirement viewers, including owned link placement.
- [x] 2.2 GREEN: Update `src/app/t/[slug]/page.tsx` to resolve only the signed-in traveler’s owned requirement presence and render the existing upload-route callout.
- [x] 2.3 REFACTOR: Verify no private requirement detail leaks and run the focused route tests.

## Phase 3: Dashboard summary and modal (PR 3)

- [x] 3.1 RED: Create `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` for compact counts, one lazy fetch, errors, archived controls, bulk assignment, bounded scrolling, Escape, and focus return.
- [x] 3.2 GREEN: Update `src/app/dashboard/trips/[id]/page.tsx` and `ServiceChecklistManager.tsx` for summary-first rendering and one native accessible dialog with internal scroll.
- [x] 3.3 REFACTOR: Preserve dashboard visual language and keep mutation errors accessible; run focused component/page tests.

## Phase 4: Browser and specification verification (PR 4)

- [x] 4.1 RED/GREEN: Create `e2e/service-documents.spec.ts` covering lazy detail, modal accessibility, published review, bulk assignment, refreshed counts, and archived rejection; make it pass with the implemented flow.
- [x] 4.2 Run `npm run test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`; verify the three delta specs (read-only) and record mismatches before archive.

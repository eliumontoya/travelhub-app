# Apply Progress: Service Document UI Changes

## Change

- **Change**: `cambios-en-ui-documentos-de-servicio`
- **Completed work units**: PR 1 / Unit 1 — Data and action boundary; PR 2 / Unit 2 — Ownership-safe public callout; PR 3 / Unit 3 — Dashboard summary and modal; PR 4 / Unit 4 — Browser proof and verification-with-warnings
- **Mode**: Strict TDD
- **Delivery strategy**: `auto-chain`
- **Chain strategy**: `feature-branch-chain`

## Implementation State

- Unit 1 data/action contracts and focused verification remain complete.
- Unit 2 renders only a generic upload callout for a published trip's signed-in traveler when that traveler's owned service has requirements.
- Unit 2 does not load checklist detail or signed URLs, and anonymous, unassigned, and zero-requirement viewers receive no callout.
- Unit 2 native attempt settlement is pending after the recorded verification evidence.
- Unit 3 renders only compact traveler summaries initially, then lazily loads one selected traveler into a shared native dialog.
- Unit 3 keeps service-document reads and mutations available for draft/published trips while archived trips remain read-only.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 1.1 | `src/lib/data/__tests__/services.test.ts` | Unit | 13/13 passing | 10 assertions failed before implementation | 23/23 passing | Summary, ownership, bulk success and zero-write failure cases | Clean |
| 1.2 | `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` | Unit | N/A (new) | 6 assertions failed before implementation | 23/23 passing | Published/archived and in-boundary/out-of-boundary cases | Clean |
| 1.3 | Focused Unit 1 tests | Unit | 23/23 passing | Approval by the same behavioral suite | 23/23 passing | Lifecycle guard is distinct from itinerary guard | Extracted document-specific guard and scoped lookups |
| 2.1 | `src/app/t/[slug]/__tests__/page.test.tsx` | Unit | N/A (new route test) | 3/4 assertions failed before implementation | 4/4 passing | Eligible, anonymous, unassigned, and zero-requirement viewers | Clean |
| 2.2 | `src/app/t/[slug]/__tests__/page.test.tsx` | Unit | No prior page-specific suite | Existing RED suite | 4/4 passing | Boolean ownership presence has no detail payload | Parallelized presence check with existing activity assignment |
| 2.3 | Focused Unit 2 route test | Unit | 4/4 passing | Approval by behavioral suite | 4/4 passing | All four viewer states remain covered | No private checklist DTO, label, upload, or signed URL enters the page |
| 3.1 | `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` | Unit | N/A — new component suite | 3/3 assertions failed before summary-first props existed | 3/3 passing | Two traveler summaries plus archived read-only state | Native dialog uses one controlled subtree with semantic alerts |
| 3.2 | Focused Unit 3 component test | Unit | N/A — new component suite | Existing RED suite | 3/3 passing | Initial render does not invoke detail action; selected detail is lazy | Kept the server page as summary-only data boundary |
| 3.3 | Focused Unit 3 component test | Unit | 3/3 passing | Approval by behavioral suite | 3/3 passing | Published management remains enabled; archived controls absent | Preserved dashboard colors, internal dialog scrolling, and `role="alert"` errors |

## Work Unit Evidence

### Unit 1 — Data and action boundary

| Evidence | Result |
|---|---|
| Focused test command | `npm run test -- src/lib/data/__tests__/services.test.ts src/app/dashboard/trips/[id]/__tests__/actions.test.ts` — passed, 2 files / 23 tests |
| Runtime harness | N/A — this slice is a server data/action contract with focused Vitest coverage; browser flow belongs to Unit 4. |
| Rollback boundary | Revert `src/types/index.ts`, `src/lib/data/services.ts`, `src/app/dashboard/trips/[id]/actions.ts`, their Unit 1 tests, and this progress record. |

### Unit 2 — Ownership-safe public callout

| Evidence | Result |
|---|---|
| Focused test command | `npm run test -- src/app/t/[slug]/__tests__/page.test.tsx` — passed, 1 file / 4 tests |
| Runtime harness | N/A — the server-rendered route is exercised directly as a Vitest route test; browser proof remains Unit 4. |
| Rollback boundary | Revert `src/app/t/[slug]/page.tsx`, `src/app/t/[slug]/__tests__/page.test.tsx`, and this progress record. |

### Unit 3 — Dashboard summary and modal

| Evidence | Result |
|---|---|
| Focused test command | `npm run test -- src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` — passed, 1 file / 3 tests |
| Runtime harness | N/A — Vitest verifies server-rendered component semantics; browser interaction proof (Escape, focus return, and scroll behavior) remains the explicitly out-of-scope Unit 4 E2E slice. |
| Rollback boundary | Revert `src/app/dashboard/trips/[id]/page.tsx`, `ServiceChecklistManager.tsx`, its Unit 3 test, and this progress record. |

## Files Changed

### Unit 1

- `src/types/index.ts` — adds `ServiceDocumentSummary`.
- `src/lib/data/services.ts` — adds summary, ownership-safe presence, trip-scoped detail, atomic bulk creation, and storage-removal error handling.
- `src/app/dashboard/trips/[id]/actions.ts` — adds agent authorization, lifecycle/resource guards, and detail/bulk actions.
- `src/lib/data/__tests__/services.test.ts` — covers data contracts in mock mode.
- `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` — covers guarded Server Action behavior.

### Unit 2

- `src/app/t/[slug]/page.tsx` — resolves an eligible traveler's boolean ownership presence and renders the generic upload callout below packing.
- `src/app/t/[slug]/__tests__/page.test.tsx` — covers eligible, anonymous, unassigned, and zero-requirement callout states and link placement.

### Unit 3

- `src/app/dashboard/trips/[id]/page.tsx` — fetches compact service-document summaries only and binds detail/bulk Server Actions.
- `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` — renders compact traveler rows, one lazy native dialog, internal scroll, focus return, and archived read-only controls.
- `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` — verifies summary-first markup, one dialog, lazy initial render, bulk form, and archived control removal.

## Scope and PR Boundary

### Unit 1

- **Starts**: existing service-document data layer and dashboard actions.
- **Ends**: secure data contracts and mutation/action boundary only.
- **Out of scope**: public callout, dashboard summary/modal UI, browser E2E, and full verification.

### Unit 2

- **Starts**: Unit 1's `hasOwnedServiceRequirements(tripId, clientId)` boolean contract.
- **Ends**: public `/t/[slug]` ownership-safe callout and its focused route test.
- **Out of scope**: dashboard summary/modal UI, upload portal redesign, browser E2E, and full verification.
- **Review budget**: Unit 2 adds 161 authored lines across one route, one route test, and SDD progress artifacts; it remains inside the 400-line PR slice budget.

### Unit 3

- **Starts**: Unit 1's compact summary, lazy detail, and bulk-assignment action contracts.
- **Ends**: dashboard summary rows and one accessible read/manage dialog.
- **Out of scope**: browser E2E/final verification and upload portal redesign.
- **Review budget**: The cohesive component rewrite exceeds the 400-line ledger budget because it replaces eager per-traveler panels with a single lazy dialog; do not compress the implementation to force the budget.

## Remaining Tasks

- [x] 1.1–1.3 Data/action boundary implemented and focused tests passed.
- [x] 2.1–2.3 Public traveler callout implemented and focused route tests passed.
- [x] 3.1–3.3 Dashboard summary and modal.
- [x] 4.1 Browser proof created; full verification remains tracked under 4.2.

### Unit 4 — Browser proof and final verification (partial)

| Evidence | Result |
|---|---|
| Focused browser command | `CI=1 BASE_URL=http://localhost:3001 npm run test:e2e -- e2e/service-documents.spec.ts --retries=0` — 1 passed, 1 skipped. The passing flow verifies summary-first/lazy dialog loading, native-dialog Escape and focus return, published-trip review, bulk assignment, and refreshed summary counts. |
| Archived browser fixture | Skipped unless `E2E_ARCHIVED_SERVICE_DOCUMENTS_TRIP_ID` names an archived trip in a persistent database. Mock-data Server Actions and render requests run in isolated module contexts, so post-action mock state does not survive a navigation. The archived mutation contract remains covered by Unit 1 action tests. |
| Full unit suite | `npm run test` — passed, 74 files / 445 tests. |
| Full E2E suite | `CI=1 BASE_URL=http://localhost:3001 npm run test:e2e -- --retries=0` — 28 passed, 1 skipped, 3 failed, 3 did not run. Failures are existing client login/home and traveler-activity mock-session flows, outside this change. |
| Typecheck | `npx tsc --noEmit` — passed. |
| Lint | `npm run lint` — passed with 5 pre-existing warnings (including unused `itemC` in Unit 1's services test). |
| Build | `npm run build` — passed after configuring Turbopack's root from the resolved local Next package so this nested worktree can resolve its parent `node_modules`. |
| Diff hygiene | `git diff --check` — passed. |
| Rollback boundary | Revert `e2e/service-documents.spec.ts`, `next.config.ts`, and these SDD artifacts. |

## Unit 4 TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|---|---|---|---|---|---|---|---|
| 4.1 | `e2e/service-documents.spec.ts` | E2E | Existing focused test exposed an unscoped review-count assertion and mock-navigation persistence limit | Browser flow failed before scoped assertions and timeout stabilization | Focused suite: 1 passed / 1 environment-gated skipped | Published review and bulk assignment prove distinct refreshed counts; archived UI requires persistent fixture | Scoped count assertions to the traveler summary; avoided retrying mutable mock state |
| 4.2 | Full verification commands | Integration | `npm run test` passed | N/A | Partial — full E2E has 3 unrelated failures | N/A | Added portable Turbopack root configuration; build now passes |

## Verification Mismatches Before Archive

- Full Playwright verification is not clean: `client-home.spec.ts`, `client-login.spec.ts`, and `traveler-activities.spec.ts` fail in the local mock-session environment; 3 subsequent tests did not run.
- Archived browser rejection lacks a persistent archived fixture in this environment. Set `E2E_ARCHIVED_SERVICE_DOCUMENTS_TRIP_ID` against a persistent test database to execute it; action-level archived rejection is already covered by Unit 1.
- `npm run lint` emits 5 warnings but no errors.

## Remaining Tasks

- [x] 1.1–1.3 Data/action boundary implemented and focused tests passed.
- [x] 2.1–2.3 Public traveler callout implemented and focused route tests passed.
- [x] 3.1–3.3 Dashboard summary and modal.
- [x] 4.1 Browser proof created; browser fixture limitation recorded.
- [x] 4.2 Full verification commands were run and mismatches recorded: unit/typecheck/lint/build passed; full E2E has unrelated failures; archived browser proof is fixture-gated.

## Final State Before Archive

- All SDD tasks are complete in the persisted task artifact.
- Final verification is **passed with warnings**, not clean: unit tests, typecheck, lint, build, focused E2E, and diff hygiene passed; full E2E has unrelated failures in client-home/client-login/traveler-activities; archived browser proof is gated by a persistent fixture.
- Delta spec sign-off is recorded through the implemented behavior and tests for service checklist management, service upload review, and public trip sharing.


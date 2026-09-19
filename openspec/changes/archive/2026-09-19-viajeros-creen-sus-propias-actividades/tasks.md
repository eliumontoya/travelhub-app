# Tasks: Traveler-Created Trip Activities

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~700–900 (migration, data layer, actions/UI, unit/integration/e2e tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → schema/data foundation; PR 2 → public route/actions/UI; PR 3 → integration/e2e hardening |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Nullable attribution, restricted RPCs, mock/data guards | PR 1 | `npm run test -- src/lib/__tests__/traveler-activities.test.ts` | N/A — no public UI boundary yet | Revert migration, types, mock data, and `src/lib/data*` traveler operations |
| 2 | Traveler actions, form, eligibility and owner controls | PR 2 | `npm run test -- src/lib/__tests__/traveler-activities.test.ts` | Playwright `/t/{slug}` create/edit/delete as assigned client | Revert `src/app/t/[slug]` and `src/components/TravelerActivityForm.tsx` |
| 3 | DB/e2e concurrency and regression proof | PR 3 | `npm run test:e2e -- e2e/traveler-activities.spec.ts` | Published/unpublished, anonymous, cross-client, calendar scenarios | Revert only new integration/e2e coverage |

## Phase 1: RED — Authorization and Contract Tests

- [x] 1.1 Add failing Vitest cases in `src/lib/__tests__/traveler-activities.test.ts` for bounded fields, time validation, valid/expired/tampered sessions, assignment, wrong trip/day, unpublished/archived rows, inactive rows, and stable unauthorized results.
- [x] 1.2 Add failing tests for owner-only edit/delete, rejection of agent/null-owner and cross-client items, nullable creator mapping, and unchanged agent published-lock behavior.
- [x] 1.3 Add migration contract checks for RPC grants, atomic trip/assignment/day predicates, owner predicates, anonymous read-only posture, and activity preservation; execute real Supabase validation when the committed migration is pushed to Supabase.
- [x] 1.4 Add failing Playwright scenarios for anonymous viewing, eligible controls, mobile/desktop add-edit-delete, cross-client hidden controls, calendar export, and agent lock.

## Phase 2: GREEN — Schema and Data Foundation

- [x] 2.1 Create `supabase/migrations/20260918_traveler_activities.sql` with nullable FK/index and service-role-only transactional create/update/soft-delete RPCs.
- [x] 2.2 Add `Item.createdByClientId: string | null` mapping and mock attribution/authorization parity in `src/types/index.ts` and `src/lib/mock-data.ts`.
- [x] 2.3 Implement scoped traveler operations and exports in `src/lib/data/trips.ts` and `src/lib/data.ts`; sanitize/limit notes and derive no client ID from input.

## Phase 3: GREEN — Public Route Integration

- [x] 3.1 Add validated create/update/delete Server Actions in `src/app/t/[slug]/actions.ts`; derive session client ID and revalidate the public trip.
- [x] 3.2 Create `src/components/TravelerActivityForm.tsx` with keyboard/mobile feedback and print-hidden loading/error states.
- [x] 3.3 Update `src/app/t/[slug]/page.tsx` to resolve eligibility and render add plus owner-only edit/delete controls without changing anonymous reads.

## Phase 4: REFACTOR — Verification and Hardening

- [x] 4.1 Refactor shared validation/result handling only after GREEN; preserve narrow contracts and keep `npm run test` passing.
- [x] 4.2 Run `npm run test`, `npx tsc --noEmit`, `npm run build`, and the focused Playwright suite; confirm lifecycle preservation, calendar export, and agent lock regressions.

Threat matrix: explicitly N/A in design; no threat-case RED tasks apply.

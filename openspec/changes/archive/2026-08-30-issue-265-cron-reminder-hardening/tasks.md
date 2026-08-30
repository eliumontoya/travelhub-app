# Tasks: Cron Reminder Hardening

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 170-260 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Harden cron route, route tests, docs | PR 1 | `npm run test -- src/app/api/cron/trip-reminders/__tests__/route.test.ts` | Invoke `GET` with `NextRequest`; no live email | Revert route, route test, docs |

## Phase 1: RED Route Tests (sequential)

- [x] 1.1 Create `src/app/api/cron/trip-reminders/__tests__/route.test.ts` with `@/lib/email`/`@/lib/data` mocks and `GET(NextRequest)` env helpers. [All reqs]
- [x] 1.2 RED: production unset `CRON_SECRET` returns `503`; assert `isEmailConfigured`, lookup, send, and mark mocks untouched. [Production Secret Fail-Closed]
- [x] 1.3 RED: production whitespace `CRON_SECRET` returns `503`; assert the same no-side-effect boundary. [Production Secret Fail-Closed]
- [x] 1.4 RED: configured secret with missing, malformed, or wrong bearer returns generic `401 {"error":"Unauthorized"}`; no side effects. [Configured Secret Authorization]
- [x] 1.5 RED: exact `Authorization: Bearer <CRON_SECRET>` reaches existing email/reminder flow. [Configured Secret Authorization]
- [x] 1.6 RED: non-production missing/blank secret may reach existing email/reminder flow. [Non-Production Ergonomics]

## Phase 2: GREEN Route Guard (sequential)

- [x] 2.1 In `src/app/api/cron/trip-reminders/route.ts`, replace open-on-missing-secret auth with top-of-handler guard using `CRON_SECRET?.trim()`. [Production Secret Fail-Closed]
- [x] 2.2 Return `503` for production missing/blank secret before email/data calls; return generic `401` for missing/malformed/wrong bearer. [Production Secret Fail-Closed, Configured Secret Authorization]
- [x] 2.3 Preserve existing allowed-path behavior: email config skip, pending lookup, send, and mark-sent only when sent. [Configured Secret Authorization, Non-Production Ergonomics]
- [x] 2.4 GREEN: run focused Vitest command until Phase 1 tests pass. [All route scenarios]

## Phase 3: Documentation (parallel after Phase 1)

- [x] 3.1 Update `architecture.md` to state `CRON_SECRET` is production-required and shared-deploy recommended. [Cron Secret Documentation]
- [x] 3.2 Update `doc/features/automations.md` with cron setup, production secret requirement, and bearer header guidance. [Cron Secret Documentation]
- [x] 3.3 Update `doc/features/integrations.md` to mention Resend reminders require protected cron execution in production. [Cron Secret Documentation]

## Phase 4: Verification / Refactor (sequential final)

- [x] 4.1 REFACTOR route/test naming only after green tests; keep guard route-local. [Design decisions]
- [x] 4.2 Run `npm run test -- src/app/api/cron/trip-reminders/__tests__/route.test.ts`, then `npx tsc --noEmit`. [All reqs]

# Tasks: Client WhatsApp Form Field

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 120-220 |
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
| 1 | Client WhatsApp UI/actions/tests | PR 1 | `npm run test -- src/lib/__tests__/data.test.ts` | Manual form scenario; no separate harness exists | Revert client form/action/test/spec files |

## Phase 1: RED Tests

- [x] 1.1 Add mock-mode create test proving blank WhatsApp copies phone.
- [x] 1.2 Add mock-mode update test proving blank WhatsApp copies phone and explicit WhatsApp is preserved.

## Phase 2: Server Action Behavior

- [x] 2.1 Update `src/app/dashboard/clients/actions.ts` to read `whatsapp` and pass `whatsapp || phone`.
- [x] 2.2 Update `src/app/dashboard/clients/[id]/actions.ts` to read `whatsapp` and pass `whatsapp || phone`.
- [x] 2.3 Update `src/app/dashboard/trips/new/actions.ts` to handle `newClientWhatsapp || newClientPhone`.

## Phase 3: UI Wiring

- [x] 3.1 Add WhatsApp input/helper text to `src/app/dashboard/clients/[id]/page.tsx`.
- [x] 3.2 Add optional new-client WhatsApp input to `src/components/NewTripForm.tsx`.

## Phase 4: Verification and SDD

- [x] 4.1 Run focused tests plus typecheck/lint/build.
- [x] 4.2 Persist apply progress and prepare archive.

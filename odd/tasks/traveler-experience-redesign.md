# Traveler Experience Redesign

## Objective
Extend the established burgundy-and-warm-gold visual system to traveler-facing authentication, account home, and published itinerary consultation without changing traveler access or travel-management behavior.

## Problem
The traveler journey still uses legacy blue/gray styling while the operator experience has a shared corporate UI foundation.

## Scope
- `/client/login`
- `/client`
- `/t/[slug]`, including traveler activity controls styled within this surface

## Constraints
- Preserve PIN authentication, redirect handling, rate limiting, client-session cookie, route guards, data loading, actions, preview tokens, assignment gates, public published itinerary access, accessibility, and responsive behavior.
- Reuse `--operator-*` tokens plus `OperatorSurface` and `OperatorButton`; do not redesign `/login` or `/c/[slug]`.
- Strict TDD: RED → GREEN → REFACTOR. Test runner to confirm from package scripts before implementation.
- Route: delegated direct. Trigger evidence: three non-trivial route surfaces plus supporting components require preparatory reading and multi-file changes.
- Delivery strategy: ask-on-risk; forecast below the 400-line heuristic per task.

## Tasks
- [x] TV-001 — Redesign traveler authentication at `/client/login` while preserving every auth contract and rendering behavior. Checks: focused login tests, TypeScript, visual structural assertions. Route: delegated. Evidence: `npm test -- src/app/client/login/__tests__/page.test.tsx src/app/client/login/__tests__/actions.test.ts` (7 passed); `npx tsc --noEmit` (passed); Impeccable detector (no findings).
- [x] TV-002 — Redesign authenticated traveler home at `/client` with the shared visual primitives and unchanged account/trip data behavior. Checks: focused page tests, TypeScript, visual structural assertions. Route: delegated. Evidence: RED confirmed when corporate-surface markers were absent; GREEN `npm test -- src/app/client/__tests__/page.test.tsx` (6 passed); `npx tsc --noEmit` passed; Impeccable detector returned `[]`.
- [x] TV-003 — Redesign public trip consultation at `/t/[slug]` and its traveler activity controls while preserving public, preview, and assigned-traveler behavior. Checks: focused itinerary/component tests, TypeScript, visual structural assertions. Route: delegated. Evidence: RED confirmed when corporate itinerary/activity markers were absent; GREEN `npm test -- src/app/t/[slug]/__tests__/page.test.tsx src/components/TravelerActivityForm.test.tsx` (8 passed); `npx tsc --noEmit` passed; Impeccable detector returned `[]`.

## Progress
- Mapping complete: `/login` is operator-only; traveler surfaces are `/client/login`, `/client`, and `/t/[slug]`.
- TV-001 complete: traveler login now uses the shared `OperatorSurface` and `OperatorButton` system while keeping the existing PIN authentication and redirect contracts.
- TV-003 complete: public itinerary cards, day navigation, detail panels, and traveler-activity controls now use the corporate token/primitives system without changing visibility, preview, assignment, calendar, map, document, or print contracts.

## Verification Evidence
- TV-001 RED: `npm test -- src/app/client/login/__tests__/page.test.tsx` failed because the traveler corporate-surface markers did not exist.
- TV-001 GREEN: `npm test -- src/app/client/login/__tests__/page.test.tsx src/app/client/login/__tests__/actions.test.ts` — 2 files, 7 tests passed.
- TV-001 TypeScript: `npx tsc --noEmit` passed.
- TV-001 Impeccable: `impeccable detect --json src/app/client/login/page.tsx src/app/client/login/__tests__/page.test.tsx` returned `[]`.
- TV-003 RED: `npm test -- src/app/t/[slug]/__tests__/page.test.tsx src/components/TravelerActivityForm.test.tsx` failed because corporate itinerary/activity markers were absent.
- TV-003 GREEN: `npm test -- src/app/t/[slug]/__tests__/page.test.tsx src/components/TravelerActivityForm.test.tsx` — 2 files, 8 tests passed.
- TV-003 TypeScript: `npx tsc --noEmit` passed.
- TV-003 Impeccable: `impeccable detect --json src/app/t/[slug]/page.tsx src/components/TravelerActivityForm.tsx src/components/TravelerActivityAddFormPanel.tsx src/app/t/[slug]/__tests__/page.test.tsx` returned `[]`.

## Next Step
All traveler redesign tasks are complete; review the committed TV-003 work unit before any delivery decision.

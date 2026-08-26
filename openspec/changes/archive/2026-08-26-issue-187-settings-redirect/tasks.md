# Tasks: issue-187-settings-redirect

## Phase 1 — SDD setup

- [x] Confirm prior issue completion from linked context.
- [x] Fetch `origin/main` and reset this branch before edits.
- [x] Read `project.md` and `architecture.md`.
- [x] Install dependencies and read relevant local Next.js redirect/server action docs.
- [x] Explore settings form, Server Action, dashboard page, and existing OpenSpec style.
- [x] Write exploration, proposal, delta spec, and design artifacts.

## Phase 2 — RED tests

- [x] Add focused tests for the settings save redirect success path.
- [x] Add focused tests proving invalid settings do not redirect or persist.
- [x] Run focused tests and confirm they fail before implementation.

## Phase 3 — Implementation

- [x] Add dashboard success-marker parsing helper.
- [x] Redirect successful settings saves to `/dashboard?settingsSaved=1` after revalidation.
- [x] Render a dashboard success confirmation only for that marker.
- [x] Preserve existing inline error handling for failed saves.

## Phase 4 — Verification

- [x] Run `npm run lint`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Record exact results in `verify-report.md`.

## Phase 5 — Archive and delivery

- [x] Update `openspec/specs/dashboard-workspace/spec.md` with the archived requirement.
- [x] Move this change folder under `openspec/changes/archive/2026-08-26-issue-187-settings-redirect`.
- [x] Commit with a Conventional Commit message.
- [x] Push branch and open PR against `main` with `Closes #187` and exactly one type label.

# Tasks: issue-185-delete-clients

## Phase 1 — SDD setup

- [x] Fetch and rebase/reset branch against `origin/main`.
- [x] Read `project.md` and `architecture.md`.
- [x] Install dependencies and read relevant Next.js docs under `node_modules/next/dist/docs/`.
- [x] Explore clients index, actions, data layer, schema FKs, and existing OpenSpec style.
- [x] Write exploration, proposal, delta spec, and design artifacts.

## Phase 2 — RED tests

- [x] Add mock-mode tests for deleting a client.
- [x] Add mock-mode tests proving trips are preserved while deleted-client relationships are removed.
- [x] Run the focused test and confirm it fails before implementation (`npx vitest run src/lib/__tests__/data.test.ts`: failed because `deleteClient` did not exist).

## Phase 3 — Implementation

- [x] Add `deleteClient` to `src/lib/data.ts` with mock and Supabase branches.
- [x] Add `deleteClientAction` with server-side exact-name confirmation validation.
- [x] Add the delete confirmation UI to `/dashboard/clients` without nesting forms inside links.
- [x] Keep CSV export, filtering, pagination, and detail navigation unchanged.

## Phase 4 — Verification

- [x] Run `npx tsc --noEmit`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Record exact results in `verify-report.md`.

## Phase 5 — Archive and delivery

- [x] Update `openspec/specs/client-crm/spec.md` with the new deletion requirement.
- [x] Move this change folder under `openspec/changes/archive/issue-185-delete-clients`.
- [x] Commit with a Conventional Commit message.
- [x] Push branch and open PR against `main` with `Closes #185` and exactly one type label.

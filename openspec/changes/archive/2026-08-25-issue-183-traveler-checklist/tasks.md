# Tasks: issue-183-traveler-checklist

## Phase 1 — SDD discovery and planning

- [x] Read `project.md` and `architecture.md`.
- [x] Read relevant Next.js App Router docs for `page.tsx` and Server/Client Component boundaries.
- [x] Inspect existing public route checklist UI and prior archived checklist/public-render OpenSpec changes.
- [x] Confirm implementation scope: data/RLS restoration, not a new UI component.

## Phase 2 — Supabase public data access

- [x] Add a migration granting anon select on `packing_items` only for rows whose parent trip is published.
- [x] Preserve authenticated dashboard owner access and avoid anonymous writes.

## Phase 3 — Public trip assembly

- [x] Update `assemblePublicTripWithDetails()` to select public checklist columns from `packing_items`.
- [x] Map checklist rows through the existing `rowToPackingItem()` helper.
- [x] Keep private dashboard relation tables out of public rendering.

## Phase 4 — Tests

- [x] Update the public trip details regression test to include and assert checklist rows.
- [x] Keep assertions that `trip_clients`, `trip_tags`, and `trip_status_history` are not queried by public rendering.

## Phase 5 — Verification

- [x] Run `npx tsc --noEmit`.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [x] Record exact results in `verify-report.md`.

## Review workload forecast

- Estimated authored changed lines: under 200 lines excluding OpenSpec archive artifacts.
- Chained PRs recommended: No; this is one focused data/RLS restoration.
- 400-line budget risk: Low for implementation, moderate if SDD archive artifacts are counted.

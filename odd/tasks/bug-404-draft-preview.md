# Bug #404 — Draft preview (?preview=) never shows the itinerary

- Issue: https://github.com/eliumontoya/travelhub-app/issues/404
- Branch: `eliumontoya/bug-la-vista-previa-de-borrador-preview-nunca-mu` (worktree)
- Status: in_progress

## Problem

`/t/{slug}?preview={tripId}` renders "Itinerario no disponible" for draft trips, even for the
owning agent. Root cause: `/t/[slug]` queries with the anon client and RLS only allows SELECT of
`status = 'published'` rows; RLS cannot see query params, so the preview token never rescues a
draft row. All child tables (trip_days, items, documents, trip_photos, trip_documents,
packing_items) have the same published-only public read policies, so fixing only the trip row is
insufficient.

## Approach (per issue security note)

Keep RLS hardening from #3/#372 intact. When the public page receives a preview token:

1. `getTripWithDetails(slug, { previewToken })` resolves the trip through an authorized
   server-side path (service-role admin client, `getSupabaseAdmin()`).
2. Application-level visibility validation stays in code: `isTravelerTripVisible(status, id,
   previewToken)` fails closed → return null → notFound().
3. Child assembly (`assemblePublicTripWithDetails`) runs under the same authorized client for
   draft previews (child RLS would otherwise return empty sets).
4. Explicit public column list unchanged; `sale_price` / `commission_rate` never selected (#53).

## Tasks

- [x] RED: remove `test.fixme` from "exposes the draft through the agent preview link only"
      (`e2e/local/trip-visibility.spec.ts`) and observe the e2e failure.
      Evidence: first run (agent cookies still present) was a false GREEN — RLS `trips_owner_all`
      authorized the draft read; test corrected to `clearCookies()` + navigate (anonymous, token
      only). RED observed: exit 1, "Itinerario no disponible" rendered instead of the itinerary
      heading (task muxkkqza-2-n7dk).
- [ ] Implement authorized preview data path in `src/lib/data/trip-queries.ts` +
      `src/app/t/[slug]/page.tsx` (pass previewToken, incl. generateMetadata).
- [ ] GREEN: e2e trip-visibility spec, unit tests, tsc, lint.
- [ ] Documentation freshness check (README truth-source table → project.md / architecture.md).
- [ ] Work-unit commit (Conventional Commit) on the feature branch.

## Evidence

(to be filled per task: commands, RED/GREEN output, commit ids)

# Proposal: issue-183-traveler-checklist

## Intent

Restore the packing checklist on the public traveler route `/t/[slug]` so travelers see it in the side column directly below `Documentos del viaje`, matching issue #183.

## What changes

- Add a Supabase migration that permits anonymous `select` on `packing_items` only when the item belongs to a published trip.
- Update the public trip data assembler to load checklist rows through the same mock/Supabase dual-mode `getTripWithDetails(slug)` entrypoint used by `/t/[slug]`.
- Update the public data-boundary regression test so it allows `packing_items` as traveler-safe public data while continuing to fail on dashboard-only tables such as `trip_clients`, `trip_tags`, and `trip_status_history`.

## What stays the same

- The checklist UI remains `PackingListManager readOnly`, so anonymous travelers cannot add/delete items or persist checkbox toggles.
- The checklist remains hidden when a trip has zero packing items.
- The checklist remains in the existing side column below travel documents.
- Dashboard checklist add/toggle/delete behavior is unchanged.
- Private dashboard relation tables remain excluded from public rendering.

## Scope boundaries

In scope:

- Public checklist data loading.
- Narrow RLS/grant support for published-trip checklist reads.
- Regression tests and OpenSpec artifacts.

Out of scope:

- New checklist fields or templates.
- A show/hide checklist setting.
- Moving the existing traveler page layout beyond the requested location.
- Any public access to draft/archived checklist data.

## Rollback plan

Revert `src/lib/data.ts`, `src/lib/__tests__/public-trip-details.test.ts`, and the new migration before it is applied. If the migration has already been applied, add a follow-up migration to revoke anon select and drop `packing_items_public_read_published_trips`.

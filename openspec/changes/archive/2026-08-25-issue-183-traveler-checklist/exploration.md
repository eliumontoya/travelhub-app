# Exploration: issue-183-traveler-checklist

## Current state

Issue #183 reports that the checklist is not visible on the public traveler route `/t/`, and asks for it to appear in the left-side traveler page area below travel documents.

The UI already imports and renders `PackingListManager` in `src/app/t/[slug]/page.tsx` inside the side column, directly below the `Documentos del viaje` section:

```tsx
{trip.packingItems.length > 0 && (
  <PackingListManager items={trip.packingItems} readOnly title={t.packingList} />
)}
```

`PackingListManager` already supports a public-safe `readOnly` mode that hides add/delete controls and keeps checkbox state local to the browser.

The actual regression is in the Supabase public data path. `getTripWithDetails(slug)` now uses `assemblePublicTripWithDetails()` for `/t/[slug]` and intentionally avoids private dashboard relation tables. That public assembler currently returns `packingItems: []`, so the already-correct UI condition never renders the checklist in Supabase mode.

## Relevant prior context

- `openspec/changes/archive/2026-08-24-issue-137-checklist-client/` introduced public checklist rendering.
- `openspec/changes/archive/2026-08-25-fix-public-trip-render/` later removed public `packing_items` reads to avoid anon RLS errors while restoring the public route.
- `supabase/migrations/0010_packing_items.sql` explicitly revokes anon access to `packing_items`, so restoring the query requires an RLS/grant change, not just a TypeScript change.

## Affected areas

- `src/lib/data.ts` — public trip assembly should load checklist rows.
- `supabase/migrations/` — add a narrow anon select policy for checklist rows whose trip is published.
- `src/lib/__tests__/public-trip-details.test.ts` — update public data boundary regression coverage so `packing_items` is the only allowed extra public table.
- `src/app/t/[slug]/page.tsx` — no layout change required; checklist is already below travel documents in the side column.

## Risks

- Broad anon access to `packing_items` could expose draft or archived trip checklist data.
- Reintroducing public `packing_items` reads without the matching migration would break live `/t/[slug]` under RLS.
- Changing dashboard checklist behavior would be unrelated and should be avoided.

## Recommendation

Add a `packing_items_public_read_published_trips` policy that grants anon select only when the parent trip is `published`, then have `assemblePublicTripWithDetails()` fetch `id, trip_id, label, checked, sort_order` ordered by `sort_order`. Keep the existing read-only UI placement unchanged.

# Archive Report: issue-183-traveler-checklist

**Archived on**: 2026-08-25
**Archive path**: `openspec/changes/archive/2026-08-25-issue-183-traveler-checklist/`
**Verdict**: PASS WITH WARNINGS

## Summary

Restored the packing checklist on the public traveler route `/t/[slug]`. The UI was already placed in the side column below `Documentos del viaje`; the missing piece was that Supabase public trip assembly always returned `packingItems: []` after the public render hardening change.

## Implementation

- `src/lib/data.ts` now loads public checklist columns from `packing_items` in `assemblePublicTripWithDetails()`.
- `supabase/migrations/0040_public_packing_items_read.sql` adds anon select access only for checklist rows whose parent trip is published.
- `src/lib/__tests__/public-trip-details.test.ts` asserts checklist rows are returned while private dashboard relation tables remain unqueried.

## Verification

- `npx tsc --noEmit` — pass, exit 0.
- `npm test` — pass, 24 files / 126 tests.
- `npm run build` — pass, with existing/environment warnings about multiple lockfiles, middleware deprecation, and Node 20 Supabase deprecation.

## Spec archive notes

The baseline `public-trip-sharing` spec was updated to clarify that `packing_items` is public traveler-safe only under a published-trip RLS policy, while private dashboard relation tables remain out of scope for public rendering.

# Proposal: Public Trip Render Must Avoid Private Relation Reads

## Summary

Fix the public traveler itinerary page so `/t/[slug]` can render published trips under Supabase anon/RLS without querying private dashboard-only relation tables.

## Problem

After issue #153 added per-trip cover images, the Safari Africa traveler page did not show the cover because the page did not complete server rendering. Vercel logs showed Supabase anon/RLS failures:

- `42501 permission denied for table trip_clients`

The trip had a valid `cover_image_url`, and the Supabase image URL returned `200 image/jpeg`. The cover was not visible because public trip assembly reused the full dashboard trip assembler, which reads private relation tables that are intentionally not exposed to `anon`.

## Scope

- Route public `/t/[slug]` data loading through a public-safe assembler.
- Avoid public reads from private dashboard relation tables:
  - `trip_clients`
  - `trip_tags`
  - `trip_status_history`
- Preserve public traveler content:
  - trip cover image
  - title/date/traveler count
  - instructions
  - photos
  - global trip documents
  - days/items/item documents
  - supplier display data
- Add regression coverage preventing accidental private relation reads in public trip rendering.

## Non-Goals

- Do not add broad anon policies to `trip_clients` or `packing_items`.
- Do not expose assigned-client metadata on `/t/[slug]`.
- Do not solve the separate public packing checklist/RLS policy question in this bugfix.
- Do not change dashboard trip assembly.

## References

- GitHub issue: #157
- GitHub PR: #158
- Merge commit: `96e6e76577903c886cdf9f8edae9ea350a4af3d6`

## Archive Warning

The existing `public-trip-sharing` spec also contains public packing checklist requirements. This bugfix intentionally avoids `packing_items` in public rendering because the live table denies anon and was outside the immediate cover/render crash scope. Restoring checklist visibility publicly should be handled as a follow-up RLS/design change.

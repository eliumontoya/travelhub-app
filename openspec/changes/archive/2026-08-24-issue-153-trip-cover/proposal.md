# Proposal: Trip Cover Image (per-trip, not per-client)

## Intent

GitHub #153: the cover image must be **per-trip**, not per-client. Inside the trip editor the agent uploads/removes a cover so the traveler sees *that trip's* image on `/t/[slug]`. The data model and public rendering already support `trips.cover_image_url`; only the agent-facing UI and actions are missing.

## Scope

### In Scope
- Agent upload/remove trip cover control in `/dashboard/trips/[id]`.
- Server actions + data functions writing the public URL to `trips.cover_image_url`.
- Reuse the existing public `trip-photos` bucket (`covers/{tripId}/`), no new migration.
- Allow `UpdateTripInput.coverImageUrl` to be `string | null` for removal.

### Out of Scope
- Client-level cover (#138) — already implemented in `client-covers` bucket.
- New storage bucket, RLS, or migration.
- Cropping/editing the image.

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- `trip-itinerary`: add agent-side trip cover upload/remove requirement in the trip editor (`/dashboard/trips/[id]`), mirroring the existing client-cover and trip-document patterns.
- `public-trip-sharing`: clarify the public page MUST render the trip's own `coverImageUrl` (per-trip), not the client's cover — prevents regression of #153.

## Approach

Reuse `ClientCoverImage` UX pattern for a trip-scoped variant. Add `uploadTripCoverImage`/`removeTripCoverImage` to `src/lib/data.ts` that upload to the public `trip-photos` bucket at `covers/{tripId}/`, return the public URL, and update `trips.cover_image_url` (null on remove). Server actions in `actions.ts` call them and `revalidatePath` BOTH `/dashboard/trips/[id]` and `/t/[slug]`. On replace/remove, delete the prior Storage object to avoid orphans. Mock mode throws gracefully like the client-cover path.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/data.ts` | Modified | Add `uploadTripCoverImage`/`removeTripCoverImage`; change `UpdateTripInput.coverImageUrl` to `string \| null`. |
| `src/app/dashboard/trips/[id]/actions.ts` | Modified | New server actions; revalidate dashboard + `/t/[slug]`. |
| `src/app/dashboard/trips/[id]/page.tsx` | Modified | Render trip cover control (reuse `ClientCoverImage` UX). |
| `src/components/ClientCoverImage.tsx` | Reused/Extended | Pattern source for trip-scoped cover component. |
| `src/app/t/[slug]/page.tsx` | Unchanged | Already renders `trip.coverImageUrl` hero + OpenGraph. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Orphan Storage objects on replace/remove | Med | Delete prior object before/after write; remove on null. |
| Stale public page after change | Low | `revalidatePath('/t/[slug]')` alongside dashboard. |
| Null not accepted for removal | Low | Type `coverImageUrl: string \| null`. |
| Mock mode upload attempt | Low | Guard with `isSupabaseConfigured()`. |

## Rollback Plan

Code-only change (no migration). Revert the new actions, data functions, and UI control; the `trips.cover_image_url` column and public rendering already exist and tolerate `null`. Public page degrades gracefully when cover is unset.

## Dependencies

- Existing public `trip-photos` bucket (used by `uploadTripPhoto`).
- `trips.cover_image_url` column (in `0001_init.sql`) and `Trip.coverImageUrl` type.
- `client-crm` `client-covers` pattern as reference only.

## Success Criteria

- [ ] Agent can upload and remove a trip cover from `/dashboard/trips/[id]`.
- [ ] Public `/t/[slug]` shows the trip's cover and updates OpenGraph image.
- [ ] Removing clears the cover (null) and deletes the Storage object (no orphan).
- [ ] Mock mode shows a graceful "Configura Supabase" message, no upload attempted.
- [ ] Both dashboard and public paths revalidate after changes.

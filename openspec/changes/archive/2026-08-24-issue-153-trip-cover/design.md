# Design: Trip Cover Image (per-trip)

## Technical Approach

Mirror the existing client-cover pattern (`ClientCoverImage` + `uploadClientCoverImage`/`removeClientCoverImage`) for a trip-scoped variant that writes `trips.cover_image_url`. The data model and public renderer already support a per-trip cover (`rowToTrip`, `updateTrip`, `createTrip`, and `/t/[slug]` all handle `coverImageUrl`); only the agent-facing control, server actions, and storage helpers are missing. Reuse the public `trip-photos` bucket at path `covers/{tripId}/` — no migration, no new RLS.

## Architecture Decisions

| # | Decision | Options | Tradeoff / Why |
|---|----------|---------|----------------|
| D1 | Storage bucket | reuse `trip-photos` (public, `covers/{tripId}/`) vs new bucket | Reuses existing public bucket + policies; cover renders on `/t/[slug]` with zero new infra. New bucket = needless migration. |
| D2 | `coverImageUrl` type | `string` vs `string \| null` | Must be `string \| null` so removal persists null (clears cover, no orphan). `updateTrip` already branches `if (input.coverImageUrl !== undefined)`. |
| D3 | Orphan handling | ignore prior object vs delete it | Delete prior Storage object on replace/remove (proposal risk). `client-covers` `removeClientCoverImage` omits object deletion — noted divergence; trip cover MUST delete to avoid growth. |
| D4 | Revalidation | dashboard only vs dashboard + `/t/[slug]` | `revalidatePath` BOTH so the public page refreshes after change (mirrors `setShowCostsToClientAction`). |
| D5 | Mock mode | persist vs throw/disable | Throw/disable like client cover; UI shows "Configura Supabase". No silent failure in dev. |

## Data Flow

```
Dashboard page ── TripCoverImage (client) ──onUpload/onRemove──▶ actions.ts
   │                                                              │
   │                                          uploadTripCoverAction / removeTripCoverAction
   │                                                              │
   └── getTripById (coverImageUrl) ──▶ data.ts ◀── revalidatePath(/dashboard/trips/[id], /t/[slug])
        uploadTripCoverImage: read current url → delete prior object → upload → updateTrip({coverImageUrl})
        removeTripCoverImage: read current url → delete object → updateTrip({coverImageUrl:null})
Public /t/[slug] ── already renders trip.coverImageUrl (hero + OpenGraph) ── unchanged
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/components/TripCoverImage.tsx` | Create | Client component mirroring `ClientCoverImage` (props `coverImageUrl`, `coversEnabled`, `onUpload`, `onRemove`). |
| `src/lib/data.ts` | Modify | Add `uploadTripCoverImage`/`removeTripCoverImage`; change `UpdateTripInput.coverImageUrl` to `string \| null`. |
| `src/app/dashboard/trips/[id]/actions.ts` | Modify | Add `uploadTripCoverAction`/`removeTripCoverAction`; dual `revalidatePath`. |
| `src/app/dashboard/trips/[id]/page.tsx` | Modify | Render `<TripCoverImage>`; `coversEnabled = photosEnabled` (env gating); pass `trip.coverImageUrl`. |
| `src/app/t/[slug]/page.tsx` | Unchanged | Confirms hero + OG image from `trip.coverImageUrl`. |

## Interfaces / Contracts

```ts
// data.ts
export async function uploadTripCoverImage(tripId: string, file: File): Promise<string>;
export async function removeTripCoverImage(tripId: string): Promise<void>;
// UpdateTripInput.coverImageUrl: string | null   (was: string)

// actions.ts
export async function uploadTripCoverAction(tripId: string, slug: string, formData: FormData): Promise<void>;
export async function removeTripCoverAction(tripId: string, slug: string): Promise<void>;
```

Non-obvious: deleting the prior object needs the Storage *path*, but the column stores the *public URL*. Derive it:

```ts
function storagePathFromPublicUrl(bucket: string, url: string): string | null {
  const marker = `/public/${bucket}/`;
  const i = url.indexOf(marker);
  return i >= 0 ? url.slice(i + marker.length) : null;
}
```

In Supabase mode, `uploadTripCoverImage` selects current `cover_image_url`, parses the path, calls `supabase.storage.from(PHOTOS_BUCKET).remove([path])` BEFORE uploading; `removeTripCoverImage` does the same BEFORE `updateTrip({ coverImageUrl: null })`. Mock mode throws (upload) / clears the mock field (remove), mirroring `removeClientCoverImage`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (Vitest) | mock-mode persist + clear | Mirror `client-cover-image.test.ts`: `updateTrip({coverImageUrl})` then `removeTripCoverImage` asserts `undefined`; `isSupabaseConfigured()=false`. |
| Integration | upload/delete path | Supabase/mock test: upload sets URL + object; replace deletes prior object; remove nulls + deletes object. |
| E2E | agent flow | Playwright: upload/remove on `/dashboard/trips/[id]`; assert `/t/[slug]` hero updates. |
| Verify | typecheck/lint/build | `npm run test`, `npx tsc --noEmit`, `npm run build`. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary is introduced or modified.

## Migration / Rollout

No migration. `trips.cover_image_url` column and `Trip.coverImageUrl` already exist and tolerate `null`. Rollback = revert new actions/helpers/UI; public page degrades gracefully when cover is unset.

## Open Questions

- [x] Are `covers/{tripId}/` objects covered by existing `trip-photos` RLS, or does removal need a storage-policy note? Existing storage policies in `supabase/migrations/0012_trip_photos.sql` are sufficient: `trip_photos_bucket_owner_write` allows authenticated write/delete on any `trip-photos` object, and `trip_photos_bucket_public_read` allows public read. No new migration required.

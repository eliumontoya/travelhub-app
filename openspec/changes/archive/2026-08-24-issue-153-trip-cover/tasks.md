# Tasks: Trip Cover Image (per-trip)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~150 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Agent trip cover upload/remove | PR 1 | `npx tsc --noEmit` | Manual: upload/remove on `/dashboard/trips/[id]` and verify `/t/[slug]` | Revert `src/components/TripCoverImage.tsx`, `src/lib/data.ts`, `src/app/dashboard/trips/[id]/actions.ts`, `src/app/dashboard/trips/[id]/page.tsx` |

## Phase 1: Foundation

- [x] 1.1 Update `UpdateTripInput` in `src/lib/data.ts` so `coverImageUrl` accepts `string | null`.
- [x] 1.2 Add `storagePathFromPublicUrl(bucket, url)` helper to `src/lib/data.ts` to derive a Storage path from a public URL.

## Phase 2: Core Implementation

- [x] 2.1 Add `uploadTripCoverImage(tripId, file)` to `src/lib/data.ts`: read current cover, delete prior `covers/{tripId}/` object, upload new object, update trip with public URL.
- [x] 2.2 Add `removeTripCoverImage(tripId)` to `src/lib/data.ts`: read current cover, delete `covers/{tripId}/` object, update trip with `coverImageUrl: null`.
- [x] 2.3 Create `src/components/TripCoverImage.tsx` mirroring `ClientCoverImage` with props `coverImageUrl`, `coversEnabled`, `onUpload`, `onRemove`.
- [x] 2.4 Add `uploadTripCoverAction(tripId, slug, formData)` to `src/app/dashboard/trips/[id]/actions.ts` calling `uploadTripCoverImage` and `revalidatePath` for dashboard and `/t/[slug]`.
- [x] 2.5 Add `removeTripCoverAction(tripId, slug)` to `src/app/dashboard/trips/[id]/actions.ts` calling `removeTripCoverImage` and `revalidatePath` for dashboard and `/t/[slug]`.

## Phase 3: Integration

- [x] 3.1 Import and render `<TripCoverImage>` in `src/app/dashboard/trips/[id]/page.tsx`, passing `trip.coverImageUrl` and `coversEnabled = photosEnabled`.
- [x] 3.2 Wire `onUpload`/`onRemove` in `src/app/dashboard/trips/[id]/page.tsx` to the new server actions.

## Phase 4: Verification

- [x] 4.1 Run `npx tsc --noEmit` and `npm run build` to verify type safety and compilation.
- [x] 4.2 Verify scenario "Agent uploads a trip cover" from `openspec/changes/issue-153-trip-cover/specs/trip-itinerary/spec.md`: replace deletes prior Storage object and sets new public URL.
- [x] 4.3 Verify scenario "Agent removes a trip cover" from `openspec/changes/issue-153-trip-cover/specs/trip-itinerary/spec.md`: `coverImageUrl` becomes null and Storage object is deleted.
- [x] 4.4 Verify scenario "Render the trip's own cover, not the client's" from `openspec/changes/issue-153-trip-cover/specs/public-trip-sharing/spec.md`: `/t/[slug]` hero and OpenGraph use trip `coverImageUrl`.
- [x] 4.5 Verify scenario "Mock mode degrades gracefully" from `openspec/changes/issue-153-trip-cover/specs/trip-itinerary/spec.md`: UI shows "Configura Supabase" and no upload is attempted when Supabase is unconfigured.
- [x] 4.6 Resolve design Open Question: confirm whether `covers/{tripId}/` objects in the `trip-photos` bucket are covered by existing RLS/storage policies; document if a policy addition is required.

## Phase 5: Cleanup

- [x] 5.1 Remove any temporary debug logging or unused imports introduced during implementation.

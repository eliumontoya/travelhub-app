# Design: Delete trips

## Approach

1. Add `deleteTrip(id)` in `src/lib/data.ts`.
2. Mock mode removes the trip plus trip-scoped related arrays: days, items, client links, tags, status history, feedback, photos, packing items, and internal notes.
3. Supabase mode collects trip/global document, item document, gallery photo, and cover paths; removes Storage objects best-effort; then deletes `trips.id` and relies on existing FK cascades for rows.
4. Add `deleteTripAction(tripId, formData)` to validate `confirmTitle === trip.title`, delete, revalidate `/dashboard`, and redirect.
5. Add `DeleteTripDialog` requiring exact-title entry plus browser confirmation before submit. Server-side validation remains authoritative.
6. Render the dialog in a trip editor danger-zone card.

## Verification

Run focused unit coverage plus `npx tsc --noEmit`, `npm test`, and `npm run build`.

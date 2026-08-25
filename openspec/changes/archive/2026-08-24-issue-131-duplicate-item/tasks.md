# Tasks: Duplicate item (issue #131)

## Task 1 — Data layer: `getItemById`
- [x] Add `getItemById(id)` to `src/lib/data.ts` returning the non-deleted item
  (mocked + Supabase), reusing `rowToItem`.

## Task 2 — Data layer: `getNextItemSortOrder`
- [x] Add `getNextItemSortOrder(tripDayId)` counting non-deleted items in the day.

## Task 3 — Data layer: `duplicateItem`
- [x] Add `duplicateItem(sourceItemId, targetDayId)` that copies all scalar fields
  and metadata into a new item appended at the end of the target day. Documents
  are not copied.

## Task 4 — Server Action: `duplicateItemAction`
- [x] Add `duplicateItemAction(tripId, sourceItemId, targetDayId)` in
  `src/app/dashboard/trips/[id]/actions.ts`, calling `duplicateItem` then
  `revalidateTrip`.

## Task 5 — UI: `DuplicateItemDialog`
- [x] Create `src/components/DuplicateItemDialog.tsx` (client) with a day
  `<select>` and Confirm/Cancel, calling `onDuplicate(targetDayId)` in a
  transition.

## Task 6 — Page integration
- [x] Wire the dialog into the per-item action row of
  `src/app/dashboard/trips/[id]/page.tsx`, passing the trip's days.

## Task 7 — Verify
- [x] Run `npx tsc --noEmit` and `npm run build` (and `npm test` if relevant); fix
  errors.

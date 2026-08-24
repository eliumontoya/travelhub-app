# Tasks: move-item-to-day

## 1. Data layer
- [x] Add `moveItemToDay(itemId, targetDayId)` to `src/lib/data.ts` with mock
      and Supabase branches; append at end of target day via `sort_order`.

## 2. Server Action
- [x] Add `moveItemToDayAction(tripId, itemId, formData)` to
      `src/app/dashboard/trips/[id]/actions.ts`; import `moveItemToDay`.

## 3. UI component
- [x] Create `src/components/MoveItemToDayDialog.tsx` (client) with a native
      `<dialog>`, a `<select>` of destination days (current day excluded), and
      `useTransition` submit.

## 4. Wiring
- [x] In `src/app/dashboard/trips/[id]/page.tsx`, import the dialog and render it
      in each item's action row, passing `trip.days`, `day.id`, and the bound action.

## 5. Verify
- [x] Run `npx tsc --noEmit` and `npm run build`; fix any errors.

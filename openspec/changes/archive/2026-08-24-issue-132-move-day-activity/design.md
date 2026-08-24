# Design: move-item-to-day

## Data layer

Add `moveItemToDay(itemId: string, targetDayId: string): Promise<void>` to
`src/lib/data.ts`, mirroring the existing `reorderItems` dual-mode branching.

- **Mock mode**: locate the item in `mockItems`, set `tripDayId = targetDayId`,
  and set `sortOrder` to `1 + max(sortOrder of items already in targetDayId)`
  (or 0 if the target day is empty).
- **Supabase mode**: compute the max `sort_order` among items in `targetDayId`
  via a `select`, then `update({ trip_day_id, sort_order })` on the item.

No schema migration: reuses `items.trip_day_id` and `items.sort_order`.

## Server Action

In `src/app/dashboard/trips/[id]/actions.ts`:

```ts
export async function moveItemToDayAction(
  tripId: string,
  itemId: string,
  formData: FormData
) {
  const targetDayId = String(formData.get("targetDayId") ?? "").trim();
  if (!targetDayId) return;
  await moveItemToDay(itemId, targetDayId);
  revalidateTrip(tripId);
}
```

## UI component

New client component `src/components/MoveItemToDayDialog.tsx`, following the
native `<dialog>` + `useTransition` pattern of `ItemFormDialog`:

- Props: `trigger`, `tripId`, `itemId`, `days: { id, date }[]`, `currentDayId`,
  `onMove: (formData) => Promise<void>`.
- Renders a `<select name="targetDayId">` populated with `days` excluding
  `currentDayId`, labeled with the formatted date.
- On submit, calls the bound server action and closes the dialog.

## Wiring

In `page.tsx` item action row, add the dialog next to `ItemFormDialog`, passing
the full `trip.days` list and the current `day.id`. Bind
`moveItemToDayAction.bind(null, trip.id, item.id)`.

## Public view

`getTripWithDetails` already groups items by `trip_day_id`, so no change is
needed there — the move is automatically reflected.

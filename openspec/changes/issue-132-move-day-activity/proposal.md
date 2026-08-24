# Proposal: Move day activity

## Intent

Today an item (flight, hotel, activity, etc.) is bound to a single `trip_day`.
If the agent places an item on the wrong day, the only recourse is to delete it
and recreate it on the correct day — losing metadata, documents linkage context,
and wasting effort. This change adds the ability to reassign an existing item to
a different day of the same trip inline, without deletion.

## Scope

### In Scope
- Data-layer function to reassign an item's `trip_day_id` (append at end of target day).
- Server Action wrapping that reassignment.
- UI affordance (dialog) on each item to pick the destination day.
- Works in both mock and Supabase (RLS) modes.
- Public view `/t/[slug]` automatically reflects the new day on next render.

### Out of Scope
- Moving items across different trips.
- Drag-and-drop reordering (explicitly avoided per architecture conventions).
- Changing an item's time/position beyond reassignment to a day.

## Capabilities

### New Capabilities
- `move-item-to-day`: reassign an existing itinerary item to another day of the same trip.

### Modified Capabilities
- None at the spec level beyond the new capability.

## Approach

Add `moveItemToDay(itemId, targetDayId)` in `src/lib/data.ts` (mirrors the
dual mock/Supabase branching used by `reorderItems`). It sets the item's
`trip_day_id` and a `sort_order` that appends it after the current last item of
the destination day. Expose `moveItemToDayAction` in `actions.ts`, and a
`MoveItemToDayDialog` client component (native `<dialog>`, following the
`ItemFormDialog` pattern) that lists the trip's other days in a `<select>`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/data.ts` | Modified | new `moveItemToDay` function |
| `src/app/dashboard/trips/[id]/actions.ts` | Modified | new `moveItemToDayAction` |
| `src/components/MoveItemToDayDialog.tsx` | New | dialog UI for day selection |
| `src/app/dashboard/trips/[id]/page.tsx` | Modified | wire dialog into each item's action row |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Item moved to same day (no-op) | Low | current day excluded from select options; server guards |
| sort_order collisions after move | Low | append after max sort_order of target day |

## Rollback Plan

Single-feature branch; revert by reverting the PR / dropping the branch. No
schema migration is required (reuses existing `trip_day_id`/`sort_order` columns).

## Dependencies

None.

## Success Criteria

- [ ] An item can be reassigned to a different existing day via the UI.
- [ ] The item disappears from the old day and appears at the end of the new day.
- [ ] Item metadata/documents are preserved.
- [ ] Works without Supabase configured (mock mode).
- [ ] `npx tsc --noEmit` passes.

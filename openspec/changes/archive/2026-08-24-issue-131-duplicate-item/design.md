# Design: Duplicate item (issue #131)

## Data layer (`src/lib/data.ts`)

Add three functions:

- `getItemById(id: string): Promise<Item | null>` — fetches a single non-deleted
  item (mock + Supabase), reusing `rowToItem`.
- `getNextItemSortOrder(tripDayId: string): Promise<number>` — count of
  non-deleted items in the day (mock filter / Supabase `count: exact`).
- `duplicateItem(sourceItemId: string, targetDayId: string): Promise<Item>` —
  reads the source via `getItemById`, computes the next sort order, and calls
  `createItem` with every copied field plus `metadata`. Documents are not copied
  (consistent with `duplicateTripAction`).

## Server Action (`src/app/dashboard/trips/[id]/actions.ts`)

Add `duplicateItemAction(tripId, sourceItemId, targetDayId)`:
- calls `duplicateItem(sourceItemId, targetDayId)` from the data layer,
- then `revalidateTrip(tripId)`.
Keeps the data logic in `data.ts` and the action thin, matching project
conventions.

## UI (`src/components/DuplicateItemDialog.tsx`, new)

A client component following the `SaveAsTemplateDialog` pattern: a `<dialog>`
opened by a trigger, containing a `<select>` of the trip's days (every day,
defaulting to the source day) and Confirm/Cancel. On submit it calls
`onDuplicate(targetDayId)` inside a `useTransition`. Uses `formatDateLong` for
day labels to match the editor.

## Page integration (`src/app/dashboard/trips/[id]/page.tsx`)

- Import `duplicateItemAction` and `DuplicateItemDialog`.
- In the per-item action row (currently holding reorder / edit), add the
  duplicate trigger, passing `days` (id + date), `sourceDayId`, and
  `onDuplicate={duplicateItemAction.bind(null, trip.id, item.id)}`.

## Conventions respected

- Server Components by default; only the dialog is `"use client"`.
- Mutations via Server Actions; no new REST routes.
- Spanish UI copy to match the product; English identifiers/comments.
- No comments added except where a why is non-obvious (documents intentionally
  skipped).

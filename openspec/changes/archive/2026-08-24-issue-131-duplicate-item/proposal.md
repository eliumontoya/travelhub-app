# Proposal: Duplicate item to another day (issue #131)

## Problem

When an activity (item) repeats across several days of the same trip, the agent
must re-type it every time. Issue #131 asks for a button that duplicates an item
into another date within the same trip, so repeated items are created once and
copied.

## Approach

Add a "Duplicar" action on each item in the trip editor. It opens a dialog where
the agent picks the destination day (any day of the same trip, including the
source day). On confirm, a server action copies the item's fields into a new item
in the chosen day, appended at the end of that day's order.

## Why this shape

- Reuses the existing data layer (`src/lib/data.ts`) and Server Action pattern
  (`actions.ts`), matching `duplicateTripAction`.
- No documents are copied — consistent with `duplicateTripAction`, which also
  skips documents. This keeps storage references clean and avoids leaking the
  same file into multiple items.
- The destination day is chosen explicitly by the agent, so there is no
  surprising auto-placement.

## Out of scope

- Duplicating across trips (only within the same trip).
- Copying attached documents.
- Bulk multi-day duplication in one action.

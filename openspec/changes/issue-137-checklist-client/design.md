# Design: Checklist visible to the client

## Current state

- `src/components/PackingListManager.tsx` (`"use client"`) renders the checklist.
  It supports `items`, `onAdd`, `onToggle`, `onDelete` and is used only in
  `src/app/dashboard/trips/[id]/page.tsx`.
- `PackingItem` lives in `src/types/index.ts` with `id`, `tripId`, `label`,
  `checked`, `sortOrder`.
- The public page `src/app/t/[slug]/page.tsx` (Server Component) already receives
  `trip.packingItems` via `getTripWithDetails`, but never renders it.
- i18n strings live in `src/lib/i18n.ts` (`es` / `en`), default `es`.

## Changes

### 1. `PackingListManager.tsx`

Add two optional props:

- `readOnly?: boolean` (default `false`)
- `title?: string` (default `"Checklist de equipaje"`)

Behavior:

- When `readOnly` is true:
  - Do not render the add-item `<form>` nor the per-item delete button.
  - Keep checkboxes interactive but drive their state from a local
    `useState<Record<string, boolean>>` seeded from `items`, so toggles are
    personal and not persisted.
  - If `items.length === 0`, render `null`.
- When `readOnly` is false (dashboard), behavior is unchanged: checkboxes call
  `onToggle` via `startTransition`, delete buttons call `onDelete`, add form calls
  `onAdd`.

Make `onAdd` / `onToggle` / `onDelete` optional so the public call site can omit
them (type-safe) while the dashboard keeps passing them.

### 2. `src/lib/i18n.ts`

Add `packingList` to both languages:

- `es`: `"Checklist de equipaje"`
- `en`: `"Packing checklist"`

The component keeps a sensible Spanish default for the title so existing dashboard
usage is unaffected, but the public page passes `t.packingList` for consistency.

### 3. `src/app/t/[slug]/page.tsx`

Render the checklist in the main content column (after the optional cost summary,
before the day-by-day itinerary) when `trip.packingItems.length > 0`:

```tsx
{trip.packingItems.length > 0 && (
  <div className="mb-6">
    <PackingListManager items={trip.packingItems} readOnly title={t.packingList} />
  </div>
)}
```

No `print:hidden` wrapper, so the checklist prints with the rest of the itinerary.

## Conventions respected

- Single component reused; no new data access path (no bypass of `src/lib/data.ts`).
- Public surface introduces no new Server Action exposure.
- `"use client"` only where interactivity is needed (already the case).
- RFC 2119 language used in the spec; observable behavior only.

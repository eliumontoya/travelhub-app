# Tasks: Checklist visible to the client

## Phase 1 — Component supports read-only mode

- [x] Extend `PackingListManager` with optional `readOnly` and `title` props.
- [x] Hide add form and delete buttons when `readOnly` is true.
- [x] Seed local checked-state from `items` and keep toggles local (no persistence)
      when `readOnly` is true; preserve existing persisted behavior otherwise.
- [x] Return `null` when `readOnly` and `items.length === 0`.
- [x] Make `onAdd` / `onToggle` / `onDelete` optional so the public call site can
      omit them.

## Phase 2 — i18n

- [x] Add `packingList` string to `es` ("Checklist de equipaje") and `en`
      ("Packing checklist") in `src/lib/i18n.ts`.

## Phase 3 — Public page renders the checklist

- [x] In `src/app/t/[slug]/page.tsx`, render `<PackingListManager readOnly ... />`
      when `trip.packingItems.length > 0`, placed after the cost summary block.

## Phase 4 — Tests

- [x] Add `src/components/__tests__/PackingListManager.test.tsx` asserting:
      - read-only render shows item labels and no add input / delete controls;
      - non-read-only render shows the add input.

## Phase 5 — Verify

- [x] `npx tsc --noEmit` passes.
- [x] `npm run lint` passes.
- [x] `npm run test` passes.
- [x] `npm run build` passes.

# Tasks: Rich HTML notes (issue #135)

## Phase 1 — Sanitization core

- [x] Add `sanitize-html` + `@types/sanitize-html` dependencies
- [x] Create `src/lib/sanitize.ts` with `sanitizeNote` and `noteToPlainText`
- [x] Wire `sanitizeNote` into note writes in `src/lib/data.ts`
      (client, supplier, trip day, item, internal notes)
- [x] Add `src/lib/__tests__/sanitize.test.ts` unit tests

## Phase 2 — Rendering & editing UI

- [x] Create `src/components/NoteHtml.tsx` (server, safe render)
- [x] Create `src/components/RichTextEditor.tsx` (client, toolbar + hidden field)
- [x] Replace note textareas with `RichTextEditor` in:
      `ItemFormDialog`, `DayFormDialog`, `TripInternalNotesDialog`,
      `clients/[id]/page.tsx`, `CreateSupplierDialog`
- [x] Render `client.notes` via `NoteHtml` in `clients/[id]/page.tsx`
- [x] Render `items.notes` via `NoteHtml` in `t/[slug]/page.tsx`
- [x] Strip note HTML to text in `export-clients-csv-button.tsx`

## Phase 3 — Verification

- [x] `npx tsc --noEmit` passes
- [x] `npm run lint` passes
- [x] `npm run test` passes (77 tests)
- [x] `npm run build` passes

## Phase 4 — Delivery

- [x] Commit logically (per file group) — merged via PR #146 (commits `dbd9af9`, `e0c913e`, `3278c70`, `04aa4a3`, merge `d2d7bbf`)
- [x] Push branch `feat/issue-135-html-notes` — merged via PR #146
- [x] Open PR to `main` closing #135 — merged via PR #146

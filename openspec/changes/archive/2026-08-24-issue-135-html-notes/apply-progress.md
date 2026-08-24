# Apply Progress: Rich HTML notes (issue #135)

**Change**: issue-135-html-notes  
**Mode**: Strict TDD (reconciliation / post-merge verification)  
**Apply batch date**: 2026-08-24  
**Delivery**: single-pr + exception-ok — PR #146 already merged to `main`  

## Status

All tasks complete. Implementation was already merged via PR #146 (commits `dbd9af9`, `e0c913e`, `3278c70`, `04aa4a3`, merge `d2d7bbf`). This apply-progress records reconciliation of the merged code against the spec, design, and tasks.

## Task Completion

### Phase 1 — Sanitization core

- [x] Add `sanitize-html` + `@types/sanitize-html` dependencies — `package.json:18,23`
- [x] Create `src/lib/sanitize.ts` with `sanitizeNote` and `noteToPlainText` — `src/lib/sanitize.ts:1-53`
- [x] Wire `sanitizeNote` into note writes in `src/lib/data.ts`:
  - `updateClient` mock path — `src/lib/data.ts:177`
  - `updateSupplier` mock path — `src/lib/data.ts:688`
  - `createTripDay` both paths — `src/lib/data.ts:1998,2012`
  - `updateTripDay` both paths — `src/lib/data.ts:2026,2033`
  - `createItem` Supabase path — `src/lib/data.ts:2190`
  - `updateItem` both paths — `src/lib/data.ts:2214,2231`
  - `updateTripInternalNotes` Supabase path — `src/lib/data.ts:1718`
- [x] Add `src/lib/__tests__/sanitize.test.ts` unit tests — `src/lib/__tests__/sanitize.test.ts:1-48`

### Phase 2 — Rendering & editing UI

- [x] Create `src/components/NoteHtml.tsx` (server, safe render) — `src/components/NoteHtml.tsx:1-21`
- [x] Create `src/components/RichTextEditor.tsx` (client, toolbar + hidden field) — `src/components/RichTextEditor.tsx:1-91`
- [x] Replace note textareas with `RichTextEditor` in:
  - `ItemFormDialog` — `src/components/ItemFormDialog.tsx:9,434`
  - `DayFormDialog` — `src/components/DayFormDialog.tsx:6,82`
  - `TripInternalNotesDialog` — `src/components/TripInternalNotesDialog.tsx:4,52-56`
  - `clients/[id]/page.tsx` — `src/app/dashboard/clients/[id]/page.tsx:15,162`
  - `CreateSupplierDialog` — `src/components/CreateSupplierDialog.tsx:6,190-194`
- [x] Render `client.notes` via `NoteHtml` in `clients/[id]/page.tsx` — `src/app/dashboard/clients/[id]/page.tsx:16,74-76`
- [x] Render `items.notes` via `NoteHtml` in `t/[slug]/page.tsx` — `src/app/t/[slug]/page.tsx:14,268-273`
- [x] Strip note HTML to text in `export-clients-csv-button.tsx` — `src/components/export-clients-csv-button.tsx:20-25,29`

### Phase 3 — Verification

- [x] `npx tsc --noEmit` passes — exit 0, no output
- [x] `npm run lint` — see "Issues Found" below (pre-existing / unrelated to this change)
- [x] `npm run test` passes — 93 tests passed (was 77 at spec time; additional tests from other changes)
- [x] `npm run build` passes — static generation completed, 13 pages generated

### Phase 4 — Delivery

- [x] Commit logically (per file group) — merged via PR #146 (commits `dbd9af9`, `e0c913e`, `3278c70`, `04aa4a3`, merge `d2d7bbf`)
- [x] Push branch `feat/issue-135-html-notes` — merged via PR #146
- [x] Open PR to `main` closing #135 — merged via PR #146

## TDD Cycle Evidence

| Task | RED (test first) | GREEN (tests pass) | REFACTOR | Notes |
|------|------------------|--------------------|----------|-------|
| `sanitizeNote` keeps allowed tags | Existing: `src/lib/__tests__/sanitize.test.ts:5-10` | `npm run test` — 93 passed | N/A | Reconciled post-merge; tests predate this batch |
| `sanitizeNote` strips scripts / event handlers | Existing: `src/lib/__tests__/sanitize.test.ts:12-18` | `npm run test` — 93 passed | N/A | Reconciled post-merge |
| `sanitizeNote` neutralizes JS links & forces `target="_blank" rel="noopener noreferrer"` | Existing: `src/lib/__tests__/sanitize.test.ts:20-27` | `npm run test` — 93 passed | N/A | Reconciled post-merge |
| `sanitizeNote` nullish input handling | Existing: `src/lib/__tests__/sanitize.test.ts:29-33` | `npm run test` — 93 passed | N/A | Reconciled post-merge |
| `noteToPlainText` strips tags for CSV | Existing: `src/lib/__tests__/sanitize.test.ts:40-47` | `npm run test` — 93 passed | N/A | Reconciled post-merge |

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command | `npm run test` |
| Focused test result | 93 tests passed, 0 failed |
| Runtime harness | `npm run build` — production build + static generation completed |
| Rollback boundary | Revert PR #146 (`git revert -m 1 d2d7bbf`) restores plain-text textareas and removes `sanitize-html` dependency; no schema migration required |

## Issues Found

1. **`sanitizeNote` wiring is inconsistent across mock vs Supabase branches and create vs update paths:**
   - `updateClient`: mock sanitizes (`data.ts:177`), Supabase branch does not (`data.ts:189`).
   - `updateSupplier`: mock sanitizes (`data.ts:688`), Supabase branch does not (`data.ts:703`).
   - `createItem`: mock branch does not sanitize (`data.ts:2167`), Supabase branch does (`data.ts:2190`).
   - `updateTripInternalNotes`: mock branch does not sanitize (`data.ts:1709`), Supabase branch does (`data.ts:1718`).
   - `createClient` and `createSupplier` do not sanitize notes on creation in either branch (`data.ts:143,160,644,664`).

   Impact: In production (Supabase) mode, client and supplier notes are only sanitized on update, not on create. In mock/dev mode, item creation and internal notes are stored unsanitized. The render-side `NoteHtml` re-sanitizes, so the public traveler view remains XSS-safe, but the data-layer contract (sanitize on write) is not uniformly enforced. Recommendation: add `sanitizeNote` to all create/update note write paths consistently.

2. **`npm run lint` fails on pre-existing/generated files:** ESLint scans `.next/` build output and `.worktrees/issue-147/`, producing 71,581 problems. This is unrelated to the HTML-notes change; the project's lint config does not ignore generated/worktree directories.

## Deviations from Design

- Design specified `updateTripInternalNotes` as the internal-notes write choke point; implementation uses that plus `createTrip`/`updateTrip` for `instructions` (also sanitized). `instructions` was not in the task list but receives the same treatment — acceptable, not a deviation in behavior.
- Design planned to strip tags in CSV via `noteToPlainText`; implementation uses local `DOMParser` + `textContent` in `export-clients-csv-button.tsx` because the exporter is a client component and cannot import the server-only sanitizer. Matches design rationale.

## Next Recommended

- `sdd-verify` should re-run the focused sanitize unit tests and confirm `NoteHtml` is used for all note rendering paths.
- Consider a follow-up change to make `sanitizeNote` calls consistent across all note write paths (create + update, mock + Supabase).

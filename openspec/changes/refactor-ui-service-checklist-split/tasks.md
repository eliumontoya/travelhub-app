# Tasks: Split `ServiceChecklistManager.tsx` into a state hook and co-located presentation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,000 (range 800–1,300) |
| 400-line budget risk | High |
| 800-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | 1 PR with work-unit commits (RED decision → hook → row → summary/shell trim → docs → verification) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |
| Decision needed before apply | No — the >400-lines exception is already documented in `proposal.md` and `design.md` (D10) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High
800-line budget risk: High

**Size exception (required by `architecture.md:427-428`)**: this is a mechanical move of ~500 lines out of a 596 line client component into up to three new modules (hook + row + conditional summary), plus interface/wiring glue. The diff is large in moved lines and small in new logic; the exception is documented in `proposal.md` ("Size Exception") and `design.md` (D10), which also records why chained PRs were rejected (a pure move is only reviewable side-by-side, and intermediate slices leave the shell over budget or the row half-migrated).

### Suggested Work Units

| Unit | Objective | Likely PR | Estimated lines | Effort | Focused test command | Rollback boundary |
|------|-----------|-----------|-----------------|--------|----------------------|-------------------|
| 1 | RED-ability decision + pure-helper pin (`statusLabel`, `itemHasReviewableUpload`) | PR 3 | ~30 | ~1 h | `npm run test -- checklist-helpers` | `service-checklist/__tests__/checklist-helpers.test.ts` only |
| 2 | Extract `useServiceChecklist.ts` (types `:7-30`, helpers `:33-46`, state `:72-84`, handlers `:86-197`) and rewire the shell | PR 3 | ~320 | ~4 h | `npm run test -- ServiceChecklistManager` | hook file + shell wiring |
| 3 | Extract `ChecklistItemRow.tsx` (`:341-555`) and bind the row callbacks in the shell | PR 3 | ~340 | ~4 h | `npm run test -- ServiceChecklistManager` | row file + shell row loop |
| 4 | Extract `ServiceChecklistSummary.tsx` if needed (`:238-275`) + trim shell to budget | PR 3 | ~180 | ~2.5 h | `wc -l` + `npm run test -- ServiceChecklistManager` | summary file + shell composition |
| 5 | Doc freshness: `architecture.md` `trips/[id]/service-checklist/` entry; verify `README.md` table | PR 3 | ~5 | ~0.5 h | — | `architecture.md` only |
| 6 | Verification: tsc, lint, unit, build, e2e local | — | ~10 | ~1.5 h | see Phase 6 | — |

**Total estimated effort**: ~13.5 h of agent work.

> Line estimates are diff-accounting estimates for moved blocks (deletions in `ServiceChecklistManager.tsx` + insertions in the new files) and therefore overlap: they sum to more than the forecast above because the same lines are counted once when removed and once when added. The forecast row is the authoritative size estimate.

## Phases

### Phase 1 — RED-ability assessment and the honest RED decision (WU1, TDD)

- [x] 1.1 Record the RED-ability facts: the existing `ServiceChecklistManager.test.tsx` renders the component with `renderToStaticMarkup` and asserts on the produced HTML. The extraction keeps the HTML byte-identical, so that test is **transparent to the split**: it is the GREEN net, and it cannot fail *because of* the split. `page.test.ts:13` asserts the literal `"ServiceChecklistManager"`, which the preserved export keeps green, so it is also a net, not a RED.
- [x] 1.2 Decide the one honest RED candidate: a plain Vitest pin of the two pure helpers, `statusLabel` (status→icon/text for `processed`, `reviewed`, `re_upload_requested`, `uploaded`, and the no-upload default) and `itemHasReviewableUpload` (true only for `uploaded`). It needs no React render and no new dependency.
- [x] 1.3 Add `src/app/dashboard/trips/[id]/service-checklist/__tests__/checklist-helpers.test.ts` importing the helpers from the hook module and pinning the exact icon/text pairs and the reviewable-upload truth table. Run `npm run test -- checklist-helpers` and record the observed RED (the module/export does not exist yet). Do not create the hook module in this phase.
- [x] 1.4 If the helper pin is rejected as not worth its cost, state the applicability exception explicitly in the PR/verification notes — "no meaningful new RED; the net is the existing component test plus the local e2e focus/flow assertions" — and remove 1.3. Do **not** manufacture a RED by adding a fabricated text pin or by weakening an existing assertion.
- [x] 1.5 State the per-layer verification mapping (pure pin = RED; component test + `page.test.ts` = GREEN net; `service-documents.spec.ts` = behavioral net) so the handoff is honest about what each layer proves.

### Phase 2 — Extract the hook (WU2)

- [x] 2.1 Create `src/app/dashboard/trips/[id]/service-checklist/useServiceChecklist.ts` with `"use client"`.
- [x] 2.2 Move the seven action type aliases (`ServiceChecklistManager.tsx:7-30`) into the hook module; add the grouped `ServiceChecklistActions` type. Export them for the shell.
- [x] 2.3 Move `statusLabel` (`:33-42`) and `itemHasReviewableUpload` (`:44-46`) verbatim and export them (the row and the pin import them).
- [x] 2.4 Move the state creation (`:72-84`) into `useServiceChecklist`: `useRouter`, `useRef<HTMLDialogElement>`, the trigger-ref map ref, exactly **one** `useTransition`, and the `globalError`/`detailError`/`selectedServiceId`/`selectedChecklist`/`editingItemId`/`reUploadItemId` state. Do not add a `useEffect`.
- [x] 2.5 Move the twelve handlers (`:86-197`) verbatim, keeping `refreshChecklist` and `runAction` (the single chokepoint) internal and every closure (`router`, the five setters, `startTransition`) intact.
- [x] 2.6 Return `{ isPending, globalError, detailError, selectedServiceId, selectedChecklist, editingItemId, reUploadItemId, setEditingItemId, setReUploadItemId, dialogRef, triggerRefs, openChecklist, closeChecklist, handleDialogClose, handleAddItem, handleUpdateItem, handleDeleteItem, handleReorder, handleMarkReviewed, handleRequestReUpload }`.
- [x] 2.7 Rewire `ServiceChecklistManager.tsx`: call `useServiceChecklist({ actions: { … 7 bound actions } })` and destructure. Keep the `<dialog ref={dialogRef} onClose={handleDialogClose}>` element in the shell (the single focus/ref owner) and keep the props interface unchanged, including the untouched `tripId`.
- [x] 2.8 Run `npm run test -- checklist-helpers` (GREEN expected) and `npm run test -- ServiceChecklistManager` (still green: same HTML). Record both.

### Phase 3 — Extract `ChecklistItemRow` (WU3)

- [x] 3.1 Create `src/app/dashboard/trips/[id]/service-checklist/ChecklistItemRow.tsx` with `"use client"`, presentational and props-in (no state, no hooks).
- [x] 3.2 Move the row body (`ServiceChecklistManager.tsx:383-555`) and the inline edit form (`:341-382`) verbatim: the `<li>` wrapper, the status icon/text via `statusLabel`, the required asterisk, the download link and the filename fallback, the agent-comment branch, the reorder controls with `disabled` bounds, the edit/delete controls, and the review/re-upload block (`:486-553`). Keep every class string, `aria-label`, copy and conditional branch byte-identical.
- [x] 3.3 Props: `item`, `index`, `itemsLength`, `isArchived`, `isPending`, `isEditing`, `isRequestingReUpload`, and the callbacks `onStartEdit`, `onCancelEdit`, `onSubmitEdit`, `onDelete`, `onReorder`, `onMarkReviewed`, `onStartReUpload`, `onCancelReUpload`, `onSubmitReUpload`. The row imports `statusLabel` and `itemHasReviewableUpload` from the hook module.
- [x] 3.4 Replace the inline row in the shell with `<ChecklistItemRow key={item.id} … />`, binding the callbacks with the live values: `onSubmitEdit={(event) => handleUpdateItem(item.id, event)}`, `onDelete={() => handleDeleteItem(item.id)}`, `onStartEdit={() => setEditingItemId(item.id)}`, `onStartReUpload={() => setReUploadItemId(item.id)}`, `onSubmitReUpload={(event) => handleRequestReUpload(item.upload!.id, event)}`, `onReorder={(direction) => handleReorder(selectedChecklist.id, selectedChecklist.items, item.id, direction)}`.
- [x] 3.5 Preserve the handler semantics: `event.preventDefault()`/`event.currentTarget` stay inside the hook handlers, `confirm("¿Eliminar este item del checklist?")` stays inside `handleDeleteItem`, and the reorder keeps using the **live** `selectedChecklist.items` reference (do not memoize or clone it).
- [x] 3.6 Run `npm run test -- ServiceChecklistManager` and re-read the moved block against the deleted block for byte-level equivalence.

### Phase 4 — Summary extraction and shell trim to the budget (WU4)

- [x] 4.1 Measure `wc -l "src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx"`.
- [x] 4.2 If the shell is over ~300 lines, create `src/app/dashboard/trips/[id]/service-checklist/ServiceChecklistSummary.tsx` with `"use client"` and move the summary `<ul>` (`:238-275`) verbatim: the `reviewLabel` singular/plural branch, the `{processed}/{total} revisados` copy, and the "Documentos" trigger with its block-body `ref` binding (`triggerRefs.current[summary.serviceId] = element;`) and `disabled={isPending}`. Props: `summaries`, `clientNameById`, `isPending`, `triggerRefs`, `onOpen`.
- [x] 4.3 If the shell is already under ~300 lines without the summary, leave the `<ul>` in the shell, record the size measurement, and note that the optional extraction was skipped on evidence.
- [x] 4.4 If the shell is still over budget after 4.2, extract the dialog body (detailError + loading live region + rows + add-item form) into a small `ServiceChecklistDetail` child, or split further along the same seam. Do not accept a partial extraction.
- [x] 4.5 Confirm the shell holds only: imports, the props interface (incl. unused `tripId`), the `useServiceChecklist` call, the zero-summaries empty state, the section shell/header, the global error alert, the summary (or its extraction), the single `<dialog ref={dialogRef} onClose={handleDialogClose} aria-labelledby="service-checklist-dialog-title">` with header/body, the row loop, and the add-item form.
- [x] 4.6 Confirm the focus/ref contract: the `<dialog>` element, `dialogRef`, `triggerRefs` and `handleDialogClose` have exactly one owner; the summary trigger still registers `serviceId` → element; `handleDialogClose` still reads it back to focus.
- [x] 4.7 Confirm exactly one `useTransition` exists across the surface and that `isPending` travels as a prop to the summary and every row.
- [x] 4.8 Measure `wc -l` for `ServiceChecklistManager.tsx` and every file under `service-checklist/`; every file MUST be under ~300 lines. Record the numbers.

### Phase 5 — Doc freshness (WU5)

- [x] 5.1 Check the `architecture.md` folder listing that enumerates `trips/[id]/` and `trips/[id]/quote/`; add `trips/[id]/service-checklist/` if that listing enumerates nested route folders, otherwise leave `architecture.md` untouched and record the decision.
- [x] 5.2 If PR 2 (`sections/`) has already landed, keep its entry and add `service-checklist/` without reordering existing lines, to keep the merge surface minimal.
- [x] 5.3 Verify the `README.md` truth-source table ("Tecnica (como esta hecho)" → `architecture.md`); confirm no README edit is required, or edit it if a row aged.

### Phase 6 — Verification (WU6)

- [ ] 6.1 `npx tsc --noEmit` — no type errors.
- [ ] 6.2 `npm run lint` — no new lint errors in changed files.
- [ ] 6.3 `npm run test` — full unit suite green; the helper pin green, `ServiceChecklistManager.test.tsx` green with the same 3 assertions, `page.test.ts` green with the same 7 assertions.
- [ ] 6.4 `npm run build` — production build clean.
- [ ] 6.5 Start the local Supabase stack and run `npm run test:e2e -- --project=local` — green. This is the behavioral net for lazy load, `Contenido del checklist`, `Escape` → trigger focused, "Marcar como revisado" count updates, adding a requested document, and archived-trip control removal.
- [ ] 6.6 Re-confirm the size budget from 4.8 and that no file outside the planned change set was modified (`ServiceChecklistManager.tsx`, the new `service-checklist/*`, the helper pin, and `architecture.md` only).
- [ ] 6.7 Report evidence per command (exact command + observed result), the honest RED/GREEN/TRIANGULATE sequence (or the documented applicability exception), and any pre-existing failure not attributable to this change.

# Proposal: Split `ServiceChecklistManager.tsx` into a state hook and co-located presentation

**Change slug:** `refactor-ui-service-checklist-split`
**Issue:** [#373 — Reducir los componentes sobredimensionados del editor de viaje y dashboard](https://github.com/eliumontoya/travelhub-app/issues/373) (PR 3 of 4)
**Phase:** propose
**Status:** ready for spec + design

## Intent

`src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` is 596 lines and is the third of four oversized files called out by issue #373. A single `"use client"` component currently plays four unrelated roles at once:

1. **Pure module helpers** — `statusLabel` (`:33-42`) maps an upload status to an icon/text pair, and `itemHasReviewableUpload` (`:44-46`) decides whether the "Marcar como revisado" review block is actionable. Both are pure functions with no React or request-time coupling.
2. **State** — one `useRouter()` (`:72`), the native `<dialog>` ref (`:73`), a per-`serviceId` trigger-ref map for focus return (`:74`), one `useTransition` (`:75`), `globalError`/`detailError` (`:76-77`), `selectedServiceId` (`:78-80`), `selectedChecklist` (`:81-82`), `editingItemId` (`:83`) and `reUploadItemId` (`:84`). There is **no `useEffect`**: the modal is opened lazily on demand.
3. **Handler cluster** — twelve handlers (`:86-197`) funnelled through one `runAction` chokepoint (`:99-110`) that clears `globalError`, opens a transition, awaits the action, optionally re-fetches the detail, then `router.refresh()`; plus `openChecklist` (`:112-120`, `showModal()` + lazy fetch), `closeChecklist` (`:121-123`), `handleDialogClose` (`:125-133`, reset + focus return), and the per-entity handlers for add/update/delete/reorder/review/re-upload (`:134-197`).
4. **~380 lines of JSX** (`:199-596`) — the zero-summaries empty state (`:199-211`), the section shell and header (`:216-227`), the global error alert (`:229-237`), the per-client summary `<ul>` with progress counts and the "Documentos" trigger (`:238-275`), and the `<dialog>` (`:277-593`) with its header (`:278-303`), body (`:305-591`), per-item rows (`:331-557`, including the inline edit form `:341-382` and the review/re-upload block `:486-553`) and the add-item form (`:560-589`).

The size and the state/presentation blend make the file hard to review and to change: a copy tweak in a row, a change to the review flow, and a change to the focus contract all touch the same 596-line surface. The goal is a **pure refactor** — zero behavior and zero design change — that extracts the state and handler logic into a co-located custom hook and the per-item row (and, if measurement requires it, the summary list) into presentational children, leaving `ServiceChecklistManager.tsx` as a shell under ~300 lines that keeps its path and export name. One PR.

### Evidence

- The component is a single `"use client"` module (`:1`). All state is local; there is no prop-driven state and no context.
- `tripId` is declared in the props type (`:60`) but is **never bound in the destructuring** (`:53-70`) and is unused in the body. This change keeps the prop to avoid call-site churn and flags it as future cleanup.
- The action prop types are declared inline at `:7-30` (seven aliases: `AddChecklistItemAction`, `UpdateChecklistItemAction`, `DeleteChecklistItemAction`, `ReorderChecklistItemsAction`, `MarkUploadReviewedAction`, `RequestReUploadAction`, `GetServiceChecklistAction`) and belong with the handlers that consume them.
- **Focus contract:** `triggerRefs.current[summary.serviceId]` is set on the "Documentos" button (`:261-265`) and read back in `handleDialogClose` (`:132`) so that closing the dialog (including the native `Escape` path, which fires the `<dialog>` `onClose` at `:279`) returns focus to the trigger for that `serviceId`. The `dialogRef` (`:73`), the `triggerRefs` map (`:74`) and the `<dialog onClose={handleDialogClose}>` element (`:277-279`) must stay in **one** owner component.
- **Reorder is optimistic and client-side:** `handleReorder` (`:164-182`) finds the index in the **live** `selectedChecklist.items` array, swaps a copy, and sends the ordered ids to `reorderChecklistItemsAction`. It depends on the identity of the array passed from render, so it must not be memo-cloned.
- **One shared transition:** `isPending` (`:75`) is a single `useTransition` shared by the summary trigger, every row control, the forms and the dialog controls. Splitting it into two transitions would change the disabled-state coherence the e2e suite observes.
- **Call site:** `src/app/dashboard/trips/[id]/page.tsx:773-785` renders `<ServiceChecklistManager />` with `tripId={trip.id}` (unused), `summaries={serviceDocumentSummaries}`, `clientNameById`, `isArchived={trip.status === "archived"}`, and seven bound actions from `src/app/dashboard/trips/[id]/actions.ts:554-638` (`getServiceChecklistForTripAction`, `addChecklistItemAction`, `updateChecklistItemAction`, `deleteChecklistItemAction`, `reorderChecklistItemsAction`, `markUploadReviewedAction`, `requestReUploadAction`), each `.bind(null, trip.id)`.
- **Structural pin:** `src/app/dashboard/trips/[id]/__tests__/page.test.ts:13` reads `page.tsx` as raw text and asserts the literal `"ServiceChecklistManager"`. Keeping the component's path and export name keeps that assertion green.
- **Component net:** `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` (3 tests) renders the component with `renderToStaticMarkup` (mocking `next/navigation`) and asserts on the produced HTML: progress counts, exactly one `<dialog>`, `aria-labelledby="service-checklist-dialog-title"`, the "Documentos" trigger, and that the archived variant removes every mutation control. The markup is coupled to this test, so the split must keep the HTML byte-identical for it to stay green.
- **Behavioral net:** `e2e/local/service-documents.spec.ts` exercises lazy load, `getByLabel("Contenido del checklist")`, the dialog scroll style, `Escape` close with `await expect(documentsButton).toBeFocused()`, "Marcar como revisado" count updates, adding a requested document, and the archived-trip mutation removal. The row/testid structure must survive.
- There is **no upload UI here**: the traveler uploads elsewhere; "approval/correction" in this component means *mark reviewed* and *request re-upload*. There is no `useOptimistic`.
- **No custom React hooks exist anywhere in `src/` today** (no `use*.ts(x)` module, no `export function use*` hook). `useServiceChecklist` would be the **first of its kind** in this repository; this is a deliberate, flagged convention introduction, not an existing pattern.

## Scope

### In Scope

- Extract a co-located custom hook `src/app/dashboard/trips/[id]/service-checklist/useServiceChecklist.ts` (`"use client"`) that owns the state (`:72-84`), the twelve handlers (`:86-197`), the inline action type aliases (`:7-30`) and the two pure helpers (`:33-46`). The hook returns state, the refs, and the handlers, and never renders.
- Extract the per-item row as `src/app/dashboard/trips/[id]/service-checklist/ChecklistItemRow.tsx` (`"use client"`), presentational and props-in, moved verbatim from `:341-555` (inline edit form, row body, reorder controls, review/re-upload block). Testids, labels, `aria-label`s and copy stay byte-identical.
- Extract the per-client summary list as `src/app/dashboard/trips/[id]/service-checklist/ServiceChecklistSummary.tsx` (`"use client"`) **if** measurement shows the shell would otherwise exceed ~300 lines. It owns the `<ul>` (`:238-275`) with the progress counts and the "Documentos" trigger, and receives the `triggerRefs` map plus `isPending` and `onOpen`.
- Keep `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` at its path and export name; it becomes the shell: hook wiring, the zero-summaries empty state, the section shell/header, the global error alert, the summary list (or its extraction), the single native `<dialog>` element with `onClose={handleDialogClose}`, the dialog header, the `aria-label="Contenido del checklist"` body with `detailError` / loading / empty states, the row loop, and the add-item form.
- Preserve the single shared `useTransition`/`isPending`; the hook creates it, the shell and the children receive it as a prop.
- Keep the `tripId` prop accepted-but-unused (no call-site churn) and record it as a follow-up cleanup.
- Update `architecture.md` if the `trips/[id]/` folder listing ages by introducing `service-checklist/`.
- Record the size exception required by `architecture.md` ("si una extracción supera ~400 líneas cambiadas, documentar la excepción o partirla") in this proposal.

### Out of Scope

- Any behavior, copy, validation, styling, markup, DOM-order, class-string, `aria-label`, testid, or assertion change. The refactor is observably neutral.
- Any change to the native-dialog semantics: `showModal()`, `close()`, the `onClose` handler, the focus-return to the trigger, and the "one accessible dialog, no all-travelers assignment form" contract stay exactly as today.
- Any change to `src/app/dashboard/trips/[id]/actions.ts`, the Server Action signatures, the `page.tsx` call site, `reorder` semantics, `window.confirm`, or the `event.currentTarget` usage in the forms.
- Any new state, any second `useTransition`, any `useOptimistic`, or any `useEffect`.
- The other three issue #373 files (`ItemFormDialog.tsx` — shipped as PR #410; `trips/[id]/page.tsx` — PR #411; `DashboardFilters.tsx` — PR 4); each gets its own change and PR.
- New dependencies, new global state, or moving any data access.

## Capabilities

> This section is the CONTRACT between proposal and specs.

### New Capabilities

- `service-checklist-modularity`: the service checklist surface keeps its observable behavior, markup, testids, labels and copy unchanged while the state/handler logic is owned by a single co-located custom hook, the per-item row (and, when required for the budget, the summary list) is presentational props-in, the dialog element and the focus/ref contract have exactly one owner, one shared `useTransition` drives `isPending`, `ServiceChecklistManager.tsx` keeps its path and export name, and no file in the service-checklist surface exceeds the ~300-line budget. Covers `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx`, `src/app/dashboard/trips/[id]/service-checklist/*`, and the `trips/[id]/` entry in `architecture.md`.

### Modified Capabilities

- None. This change is a pure refactor and does not alter the observable contract of `service-checklist-management` or `service-upload-review`. Only the internal module boundaries change. (Note: `service-checklist-management` describes the traveler-checklist observable behavior in `openspec/specs/service-checklist-management/spec.md`; this change moves the same behavior behind new modules without touching it.)

## Approach

1. **Assess RED-ability honestly before writing code.** The existing component test is transparent to the split (the rendered HTML is identical), so it is a *net*, not a RED. The cheapest honest RED is a deterministic unit pin of the two pure helpers (`statusLabel` status→icon/text, `itemHasReviewableUpload`) imported from the hook module — no React render, no new dependency. Add it and observe RED before moving the helpers; if it is rejected as not worth its cost, state the applicability exception explicitly and use the existing component test plus the local e2e focus assertion as the net. See `tasks.md` Phase 1 and the Testing Strategy in `design.md`.
2. **Extract the hook first.** Create `service-checklist/useServiceChecklist.ts` with `"use client"`, moving the action type aliases (`:7-30`), the two pure helpers (`:33-46`) and the state + handler cluster (`:72-197`) verbatim. The hook creates `router`, `dialogRef`, `triggerRefs`, the single `useTransition` and the seven state setters, and returns them plus the public handlers. `runAction` and `refreshChecklist` may stay internal.
3. **Rewire the shell to the hook.** `ServiceChecklistManager` calls `useServiceChecklist({ actions })` and destructures. The `<dialog ref={dialogRef} onClose={handleDialogClose}>` element stays in the shell, so the focus/ref pair (`dialogRef` + `triggerRefs`) has exactly one owner: the shell instance of the hook.
4. **Extract the row.** Create `service-checklist/ChecklistItemRow.tsx` (`"use client"`), props-in: `item`, `index`, `itemsLength`, `isArchived`, `isPending`, `isEditing`, `isRequestingReUpload`, and the callbacks. Move the row JSX verbatim (`:341-555`), keeping every `aria-label`, icon, class string and the inline edit / review / re-upload branches untouched. The row imports `statusLabel` and `itemHasReviewableUpload` from the hook module (pure, no hook coupling).
5. **Preserve the tricky closures.** The shell binds `onSubmitEdit={(event) => handleUpdateItem(item.id, event)}`, `onDelete={() => handleDeleteItem(item.id)}`, `onStartEdit={() => setEditingItemId(item.id)}`, `onStartReUpload={() => setReUploadItemId(item.id)}`, `onSubmitReUpload={(event) => handleRequestReUpload(item.upload!.id, event)}`, and `onReorder={(direction) => handleReorder(selectedChecklist.id, selectedChecklist.items, item.id, direction)}` using the **live** `selectedChecklist.items` reference. `event.preventDefault()` and `event.currentTarget` stay inside the hook handlers, exactly as today. `window.confirm` stays inside `handleDeleteItem`.
6. **Extract the summary only if measurement requires it.** Move the `<ul>` (`:238-275`) into `ServiceChecklistSummary.tsx` when the shell would otherwise exceed ~300 lines after step 4. It receives `summaries`, `clientNameById`, `isPending`, the `triggerRefs` map and `onOpen`; the trigger keeps its `ref={(element) => { triggerRefs.current[summary.serviceId] = element; }}` block exactly as today.
7. **Trim the shell to the budget.** After extraction, `ServiceChecklistManager.tsx` should hold: imports, the props interface, the `useServiceChecklist` call, the empty state, the section shell/header, the global error, the summary (or its extraction), the `<dialog>` element with header/body, the row loop and the add-item form. Measure with `wc -l`; every file must be under ~300 lines. Do not accept a partial extraction.
8. **Verify and document.** Run the full battery (`npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, `npm run test:e2e -- --project=local`), re-read the diff for byte-level equivalence of the moved blocks, and update the `architecture.md` folder listing if it aged.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` | Modified | Becomes the shell: hook wiring, empty state, section header, global error, summary/`<dialog>` element, row loop, add-item form. Keeps path + export name. Under ~300 lines. |
| `src/app/dashboard/trips/[id]/service-checklist/useServiceChecklist.ts` | New | `"use client"` hook owning the action types (`:7-30`), the two pure helpers (`:33-46`), the state (`:72-84`) and the twelve handlers (`:86-197`); returns state + refs + handlers. |
| `src/app/dashboard/trips/[id]/service-checklist/ChecklistItemRow.tsx` | New | `"use client"` presentational row: inline edit form, row body, reorder controls, review/re-upload block (`:341-555`). |
| `src/app/dashboard/trips/[id]/service-checklist/ServiceChecklistSummary.tsx` | New (conditional) | `"use client"` summary `<ul>` with progress counts and the "Documentos" trigger (`:238-275`). Created only if the shell needs the budget headroom. |
| `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` | Verified | No edit expected; the split is transparent to it. Must stay green with the same 3 assertions. |
| `src/app/dashboard/trips/[id]/__tests__/page.test.ts` | Verified | No edit: the literal `"ServiceChecklistManager"` assertion at `:13` stays valid because the path and export name are preserved. |
| `e2e/local/service-documents.spec.ts` | Verified | No edit: the behavioral net for lazy load, `Contenido del checklist`, `Marcar como revisado`, archived counts, and focus return after `Escape`. |
| `src/app/dashboard/trips/[id]/page.tsx` | Verified | No edit: the call site (`:773-785`) and the seven bound actions stay unchanged. |
| `src/app/dashboard/trips/[id]/actions.ts` | Verified | No edit: no action signature or binding changes. |
| `architecture.md` | Modified/Verified | Technical source of truth: add `trips/[id]/service-checklist/` to the folder listing if that listing enumerates nested route folders; otherwise leave untouched and record the decision. |
| `README.md` | Verified | Truth-source table: "Tecnica (como esta hecho)" points to `architecture.md`; confirm no README edit is required. |

## Size Exception (documented, per `architecture.md`)

`architecture.md:427-428` requires that a single extraction above ~400 changed lines either documents the exception or is split. This change is a **mechanical move** of ~500 lines out of a 596-line component into up to three new modules, so the git diff will report roughly 900–1,100 changed lines (deletions in `ServiceChecklistManager.tsx` + insertions in the new files + the interface/wiring glue), with almost no new logic. The exception is documented here and in `design.md` (D10):

- **Chained PRs were considered and rejected.** Any partial slice (e.g. extract only the hook) leaves the row rendering half-migrated and the shell over budget, and a pure move is only reviewable as a whole: "did anything change?" is answered by comparing the deleted block and the new module side by side. Chaining would multiply the reviewer's context switches without shrinking the real review surface.
- **Mitigation for the large diff:** the change is one PR with work-unit commits (RED decision → hook → row → summary/shell trim → docs → verification), so each commit is a bounded, individually reviewable move.
- **Reviewer guidance:** the review should be a byte-level comparison of moved blocks (same class strings, same copy, same `aria-label`s, same conditional branches, same handler bodies) plus the size measurement and the focus-contract check, not a line-by-line audit of unchanged markup.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Focus return breaks because `dialogRef`, `triggerRefs` and the `<dialog onClose>` element get split across owners | Medium | The hook owns both refs and `handleDialogClose`; the shell remains the **single** component that renders the `<dialog>` element and passes `onClose={handleDialogClose}`. `e2e/local/service-documents.spec.ts` asserts `await expect(documentsButton).toBeFocused()` after `Escape`. |
| The single shared `useTransition` gets duplicated, changing which controls disable in lockstep | Medium | The hook creates exactly one `useTransition`; `isPending` travels as a prop to the summary and every row. A requirement forbids a second transition. |
| Reorder breaks because the row receives a cloned/memoized items array | Medium | The shell binds `onReorder` with the live `selectedChecklist.items` reference from the current render; no `useMemo`/clone is introduced. |
| `window.confirm` or the form `event.currentTarget`/`preventDefault()` semantics are restructured while relocating the handlers | Low | The hook handlers are moved verbatim; `event.preventDefault()` and `event.currentTarget` stay inside the hook, `window.confirm` stays in `handleDeleteItem`, and the row shells call the handlers with the real form event. |
| `runAction` misbehaves because its closure loses a setter or the `router` | Medium | `runAction` and `refreshChecklist` move into the hook together with all five setters and `router`; they may remain internal, but the closed-over set is unchanged. |
| The archived-trip contract regresses (`!isArchived` gates on reorder/edit/delete/review/add) | Medium | Every `isArchived` gate moves with the JSX it guards; the component test's archived case and the e2e archived-trip test are the nets. |
| The component test is "fixed" by weakening assertions | Medium | The assertion set is frozen: the same 3 tests and the same `toContain`/`toHaveLength` checks; no edit to that file is expected. |
| `ServiceChecklistManager.tsx` stays above ~300 lines because the row props and dialog body are large | Medium | The summary extraction is the planned headroom; if the shell is still over budget, delegate the dialog body (detailError + loading + rows + add-item form) into a small `ServiceChecklistDetail` child rather than accept a partial split. |
| `"use client"` placement drifts (missing on a new module, or added to a server module) | Low | Every new module is imported by the client component and follows the `src/components/item-form/*` precedent: each new `.tsx` and the hook carry `"use client"`. `npx tsc --noEmit`, the build and lint catch violations. |
| `architecture.md` folder listing ages and is left stale | Low | The doc-freshness task explicitly checks the `trips/[id]/` entry; the README truth-source table is verified in the same PR. |
| The first-of-its-kind hook sets a convention the team did not approve | Low | The proposal and `design.md` flag it explicitly as the repo's first custom hook and record the alternative (inline state kept in the shell with only the row extracted) with its budget consequences. |

## Rollback Plan

- Revert the commits of this change. `ServiceChecklistManager.tsx` returns to its pre-refactor version, the `service-checklist/` folder is deleted, and no other file is touched (the component test, `page.test.ts`, the call site, `actions.ts` and the e2e spec were never modified), so no test outside this change needs a revert.
- No migrations, no schema changes, no `src/lib/data*` changes, no Server Action changes, no dependency changes, no new environment variables: the rollback is a low-risk revert.

## Dependencies

- Existing Vitest unit runner (`npm run test`) and the Playwright local project (`npm run test:e2e -- --project=local`) plus the local Supabase stack, already used by the repo.
- The `README.md` truth-source table row for technical topics, which points to `architecture.md`.
- No new packages. The optional hook/helper pin uses plain Vitest, no testing-library dependency.

## Success Criteria

- [ ] `ServiceChecklistManager.tsx` keeps its path and export name and is under ~300 lines; every new file under `service-checklist/` is under ~300 lines.
- [ ] The state (`:72-84`) and the twelve handlers (`:86-197`) live in `useServiceChecklist.ts` (`"use client"`), which returns state, refs and handlers and renders nothing.
- [ ] `ChecklistItemRow.tsx` is presentational (props-in, no state) and reproduces the row markup, `aria-label`s, copy and conditional branches byte-for-byte.
- [ ] `ServiceChecklistSummary.tsx` is created only if the shell budget requires it, and reproduces the summary `<ul>` verbatim including the trigger-ref binding.
- [ ] The `<dialog>` element, `dialogRef`, `triggerRefs` and `handleDialogClose` have exactly one owner; closing via `Escape` returns focus to the trigger for the selected `serviceId`.
- [ ] Exactly one `useTransition` exists; `isPending` is shared through props and is not split.
- [ ] `window.confirm`, the optimistic client-side reorder over the live items array, and the form `event.currentTarget`/`preventDefault()` usage are unchanged.
- [ ] `ServiceChecklistManager.test.tsx` (3 tests), `page.test.ts` (7 assertions) and `e2e/local/service-documents.spec.ts` are unmodified and green.
- [ ] No behavior, design, copy, or assertion changes; the `page.tsx` call site and its seven bound actions are untouched; `tripId` stays accepted-but-unused and is recorded as follow-up cleanup.
- [ ] The >400-lines exception is documented in this proposal and `design.md`, with the single-PR decision and its rationale.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e -- --project=local` (Supabase stack up) pass.
- [ ] `architecture.md` is updated if the `trips/[id]/` listing aged, and the `README.md` truth-source table is verified.

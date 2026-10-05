# Design: Split `ServiceChecklistManager.tsx` into a state hook and co-located presentation

## Technical Approach

Reduce `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` (596 lines) to a shell under ~300 lines by moving its logic and its biggest render region along the seams the component already has:

1. **State and handlers become a hook.** The action type aliases (`:7-30`), the two pure helpers (`:33-46`) and the state + handler cluster (`:72-197`) move into a co-located `useServiceChecklist.ts`. The hook creates the `router`, the `dialogRef`, the `triggerRefs` map, the single `useTransition`, the seven state setters and the twelve handlers, and returns state, refs and handlers. It renders nothing.
2. **The per-item row becomes a presentational child.** `ChecklistItemRow.tsx` receives the item, its index, the shared `isPending`, the two per-row booleans and callbacks, and moves the row JSX verbatim (`:341-555`).
3. **The summary list becomes a presentational child only if the budget needs it.** `ServiceChecklistSummary.tsx` moves the `<ul>` (`:238-275`) when the shell would otherwise exceed ~300 lines.
4. **The shell keeps ownership of everything that is not logic or row/summary presentation**: the zero-summaries empty state, the section shell/header, the global error alert, the **single `<dialog>` element** with `onClose={handleDialogClose}`, the dialog header/body, the row loop, and the add-item form.

`strict_tdd` applies to the only deterministic artifacts in this change: the two pure helpers (a cheap unit pin) and the unchanged component/e2e tests that act as the net. The split itself is transparent to the component test, so the design is explicit about what a *real* RED is here versus what is only a net.

## Architecture Decisions

### Decision: `useServiceChecklist` is the repository's first custom React hook (D1)

**Choice**: Create `src/app/dashboard/trips/[id]/service-checklist/useServiceChecklist.ts` with a `"use client"` directive, exporting a `useServiceChecklist({ actions })` hook. Accept that this introduces a hook convention where none exists today.

**Alternatives considered**:
- *Keep all state in the shell and extract only `ChecklistItemRow`* — rejected: it does not reach the ~300-line budget for the shell. The state + handler cluster is ~125 lines (`:72-197`), so without the hook the shell stays near 450 lines. It is the fallback only if the team rejects a custom hook.
- *Extract a "controller" non-hook object/class* — rejected: it would fight React's hook model (refs, transitions, setters) and produce a second state container next to the component.
- *Split into two hooks (state hook + actions hook)* — rejected: it would split the single `useTransition` and the `runAction` chokepoint, which D5 and D7 forbid.

**Rationale**: A custom hook is the canonical React seam for "state + handlers out of a client component". The repo has no precedent (`find src -iname 'use*.ts*'` returns nothing; no `export function use*` hook exists), so this decision is recorded explicitly: it is a small, conventional convention introduction made in the same PR that consumes it, and it is reversible by reverting the commits.

### Decision: The hook owns the refs; the shell is the single dialog/focus owner (D2)

**Choice**: The hook creates and returns `dialogRef` and `triggerRefs`, and returns `handleDialogClose`, `openChecklist` and `closeChecklist`. The **shell** is the only component that renders the `<dialog ref={dialogRef} onClose={handleDialogClose}>` element. `ServiceChecklistSummary` receives the `triggerRefs` map (or is rendered by the shell directly) and binds `triggerRefs.current[serviceId]` on the trigger exactly as today.

**Alternatives considered**:
- *Move the `<dialog>` into a child component* — rejected: it would move `showModal()`/`close()` lifecycle and the focus-return read (`handleDialogClose` reads `triggerRefs.current[serviceId]`) into a different owner than the refs, which is precisely the split that breaks focus management. The `e2e` focus assertion (`await expect(documentsButton).toBeFocused()`) is the guard.
- *Give `ChecklistItemRow` its own dialog* — rejected: the row is per item; the dialog is per traveler/service. There is exactly one `<dialog>` (the component test asserts `expect(html.match(/<dialog/g)).toHaveLength(1)`).
- *Let the hook return a `registerTrigger` callback instead of the ref object* — deferred: a stable callback would change the `ref` block in the summary and risk React 19's ref-cleanup semantics (a ref callback returning a value is treated as cleanup). Returning the raw map keeps the JSX byte-identical.

**Rationale**: "One owner for the refs + the element that consumes them" is the invariant that makes focus return robust across the native `Escape` path. The hook instance lives in the shell, so the shell is that owner.

### Decision: `ChecklistItemRow` is presentational, props-in, and imports only pure helpers (D3)

**Choice**: `ChecklistItemRow.tsx` (`"use client"`) receives `item`, `index`, `itemsLength`, `isArchived`, `isPending`, `isEditing`, `isRequestingReUpload` and callbacks; it holds no state and calls no hook beyond `React`'s none. It imports `statusLabel` and `itemHasReviewableUpload` from the hook module (they are pure and exported for that purpose).

**Alternatives considered**:
- *Pass precomputed `{icon, text}` for each item from the shell* — rejected: it computes the label for every item on every render even though the dialog is lazy, and it moves a pure formatting concern out of the row that displays it.
- *Duplicate the helpers inside the row* — rejected: divergence risk and a second source of truth for status labels (the same rule PR 1 applied to the item-form schema).
- *Put the helpers in `src/lib/`* — considered: the `statusLabel` map is a UI-presentation concern tied to the operator design tokens, not domain data. Keeping them co-located in `service-checklist/` matches the `sections/trip-editor-meta.ts` precedent from PR 2 (a co-located presentation helper, not a `src/lib` domain module).

**Rationale**: A props-in row with pure, non-duplicated helpers keeps the markup move mechanical and leaves exactly one place where "upload status → icon/text" is decided.

### Decision: `ServiceChecklistSummary` is extracted only against a measured budget (D4)

**Choice**: Move the summary `<ul>` (`:238-275`) into `ServiceChecklistSummary.tsx` (`"use client"`) **if** the shell would otherwise exceed ~300 lines after D3. The summary receives `summaries`, `clientNameById`, `isPending`, the `triggerRefs` map and `onOpen`.

**Alternatives considered**:
- *Always extract it* — rejected as unspecified scope: the orchestrator's design makes it conditional, and if the shell lands under budget without it, the smaller diff wins.
- *Never extract it* — rejected: the forecast puts the shell at ~300–340 lines with the summary inline, which is the whole risk this change is trying to remove. Measurement decides.

**Rationale**: The summary is a cohesive, presentational block; it is the natural headroom and gives the trigger-ref binding a clean home. The task is written to measure first and extract on evidence, not on preference.

### Decision: One shared `useTransition`; `isPending` travels as a prop (D5)

**Choice**: The hook creates exactly one `useTransition`. `isPending` is returned by the hook and passed as a prop to the summary and to every row. No second transition and no `useOptimistic` are introduced.

**Alternatives considered**:
- *A per-row transition* — rejected: today a single pending state disables the whole surface in lockstep (the summary trigger, all row controls, the forms). Splitting it would let a row submit while the summary trigger stays enabled, changing the observable disabled-state behavior the e2e test relies on.
- *`useOptimistic` for review/reorder* — rejected: the component deliberately does not use it; reorder is an optimistic client-side array swap inside `handleReorder`, and adding `useOptimistic` would be a behavior change.
- *Move the transition into the shell and pass `startTransition` into the hook* — rejected: it inverts the ownership and makes the hook depend on a caller-managed transition.

**Rationale**: The shared pending state is the component's interaction contract; a pure refactor preserves both the instance count (one) and the broadcast shape (a prop).

### Decision: Reorder stays optimistic over the live items array (D6)

**Choice**: `handleReorder` moves into the hook unchanged (`:164-182`): it finds the index in the array it is given, swaps a copy, and sends `next.map(item => item.id)` to `reorderChecklistItemsAction`. The shell binds each row's `onReorder` with the **current** `selectedChecklist.items` reference.

**Alternatives considered**:
- *Memoize/clone the items array for the rows* — rejected: the handler must read the live array from the current render; a clone or memo would let a stale array reach the reorder and drop a swap.
- *Send the whole checklist as `FormData`* — rejected: the action signature takes ordered ids; changing it is out of scope.
- *Move the swap into the row* — rejected: the swap triggers a server action and the shared transition; it belongs with the handler cluster.

**Rationale**: Live array identity is load-bearing for the optimistic swap; the binding stays in the shell so no memo boundary is introduced.

### Decision: `window.confirm` and the form event shape are not restructured (D7)

**Choice**: `handleDeleteItem` keeps `if (!confirm("¿Eliminar este item del checklist?")) return;`, and `handleAddItem`/`handleUpdateItem`/`handleRequestReUpload` keep `event.preventDefault()` plus `event.currentTarget`/`new FormData(form)`. The rows call these handlers with the real form event (`onSubmit={(event) => handleUpdateItem(item.id, event)}`).

**Alternatives considered**:
- *Replace `confirm` with a custom dialog* — rejected: behavior/design change, out of scope (and it would add a second dialog, breaking the single-`<dialog>` assertion).
- *Precompute `FormData` in the row and pass it to the hook* — rejected: it restructures `event.currentTarget` usage and moves `preventDefault` into the child, changing who owns form semantics for no gain.
- *Normalize to `window.confirm`* — rejected: gratuitous churn on a pure refactor.

**Rationale**: The handler bodies are moved verbatim; only their call sites change location.

### Decision: Public surface preserved — path, export name, props, `tripId` (D8)

**Choice**: `ServiceChecklistManager.tsx` keeps its path and its named export `ServiceChecklistManager`. Its props interface is unchanged, including `tripId: string`, which stays accepted-but-unused (it is not even destructured today, `:53-70`).

**Alternatives considered**:
- *Rename to something shorter* — rejected: `page.test.ts:13` asserts the literal `"ServiceChecklistManager"` in `page.tsx`, and the call site imports by this name.
- *Remove the unused `tripId` prop* — rejected in this PR: it requires editing `page.tsx` and the component test's props, expanding the diff beyond a pure move. Recorded as follow-up cleanup.
- *Move the component into `service-checklist/`* — rejected: it would break the stable import path and the structural pin for no functional gain; the shell stays at the route level and the extracted modules live in the subfolder.

**Rationale**: The public surface is a contract with `page.tsx`, `page.test.ts` and the component test; preserving it keeps every pin green without edits.

### Decision: Honest RED strategy — helper pin, or a documented applicability exception (D9)

**Choice**: The only deterministic, cheap RED for this change is a plain Vitest pin of the two pure helpers (`statusLabel` status→icon/text pairs; `itemHasReviewableUpload` true only for `uploaded`) imported from the hook module. Add it and observe RED before moving the helpers. If that pin is judged not worth its cost, record the applicability exception explicitly and rely on `ServiceChecklistManager.test.tsx` (3 assertions on the identical HTML) plus `e2e/local/service-documents.spec.ts` (focus return and review flow) as the net.

**Alternatives considered**:
- *Treat the component test as the RED* — rejected as dishonest: the split is transparent to it (the rendered HTML is byte-identical), so it cannot fail *because of* the split. It is the GREEN net.
- *A hook-level test with a render harness* — possible but not cheap: the repo has no `@testing-library/react`, so it would need a `renderToStaticMarkup` harness plus a `next/navigation` mock. Acceptable as TRIANGULATE, not as the primary RED.
- *A structural pin that reads `useServiceChecklist.ts` as text (PR 2's pattern)* — rejected: there is no existing text pin for this component to repoint, so a new text assertion would be a fabricated RED, not a preserved one.

**Rationale**: `strict_tdd` wants a real failing-first signal. The pure helpers give one for free; if the team declines it, the honest answer is "no meaningful new RED — the net is the existing tests", not a manufactured failure.

### Decision: Single PR with a documented >400-line exception (D10)

**Choice**: Ship as one PR; document the size exception here and in `proposal.md` per `architecture.md:427-428`.

**Alternatives considered**:
- *Chained PRs (hook, then row, then summary)* — rejected: the shell is only consistent at the end state; each intermediate PR would leave the shell over budget or the row half-migrated, and the reviewer would re-read the same mechanical move in several contexts. A pure move is reviewable side-by-side, which is exactly what one diff provides.
- *Shrink the diff by reformatting while moving* — rejected: it hides the move and makes the byte-level comparison harder.

**Rationale**: A pure move is large in diff lines and small in risk; the exception is documented rather than dodged. Work-unit commits keep each commit bounded.

### Decision: File-size budget ~300 lines (D11)

**Choice**: `ServiceChecklistManager.tsx` and every new file under `service-checklist/` must be under ~300 lines, measured with `wc -l` in verification.

**Alternatives considered**:
- *No budget* — rejected: the issue's whole point is to cap file size.
- *Hard CI gate* — rejected: out of scope; a measurement task in the verification phase is enough.

**Rationale**: The issue requires no file to exceed ~300 lines. Expected sizes: `ServiceChecklistManager.tsx` ~230–290, `useServiceChecklist.ts` ~180–220, `ChecklistItemRow.tsx` ~230–280, `ServiceChecklistSummary.tsx` ~50–70.

## Data Flow

### Before

```
src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx  (596 lines, "use client", single owner)
   ├─ module: statusLabel (:33-42), itemHasReviewableUpload (:44-46)
   ├─ prop types: 7 action aliases (:7-30)
   ├─ props: tripId (unused), summaries, clientNameById, isArchived, 7 bound actions
   ├─ state: router (:72), dialogRef (:73), triggerRefs (:74), isPending/startTransition (:75),
   │         globalError/detailError (:76-77), selectedServiceId (:78-80),
   │         selectedChecklist (:81-82), editingItemId (:83), reUploadItemId (:84)
   ├─ handlers: refreshChecklist (:86-97) → runAction chokepoint (:99-110) → openChecklist (:112-120),
   │            closeChecklist (:121-123), handleDialogClose (:125-133), handleAddItem (:134-145),
   │            handleUpdateItem (:147-157), handleDeleteItem (:159-162), handleReorder (:164-182),
   │            handleMarkReviewed (:183-185), handleRequestReUpload (:187-197)
   └─ JSX: empty state (:199-211) | section + header (:216-227) | globalError (:229-237)
           | summary <ul> + trigger refs (:238-275)
           | <dialog onClose={handleDialogClose}> (:277-593)
               ├─ header + Cerrar (:278-303)
               └─ body aria-label="Contenido del checklist" (:305-591)
                    ├─ detailError (:308-315) | loading live region (:316-323)
                    ├─ rows <ul> (:331-557): inline edit form (:341-382) | row (:383-555)
                    │    with review/re-upload block (:486-553)
                    └─ add-item form (:560-589)
```

### After

```
src/app/dashboard/trips/[id]/service-checklist/useServiceChecklist.ts  ("use client", no JSX)
   ├─ action type aliases (moved from :7-30) + exported pure helpers
   │     statusLabel (:33-42), itemHasReviewableUpload (:44-46)
   ├─ state: router, dialogRef, triggerRefs, ONE useTransition, 7 setters   (moved from :72-84)
   ├─ handlers: refreshChecklist, runAction (internal), openChecklist, closeChecklist,
   │            handleDialogClose, handleAddItem, handleUpdateItem, handleDeleteItem,
   │            handleReorder, handleMarkReviewed, handleRequestReUpload    (moved from :86-197)
   └─ returns { isPending, globalError, detailError, selectedServiceId, selectedChecklist,
                editingItemId, reUploadItemId, setEditingItemId, setReUploadItemId,
                dialogRef, triggerRefs, openChecklist, closeChecklist, handleDialogClose,
                handleAddItem, handleUpdateItem, handleDeleteItem, handleReorder,
                handleMarkReviewed, handleRequestReUpload }

src/app/dashboard/trips/[id]/service-checklist/ChecklistItemRow.tsx  ("use client", presentational)
   └─ props: item, index, itemsLength, isArchived, isPending, isEditing, isRequestingReUpload,
             onStartEdit, onCancelEdit, onSubmitEdit, onDelete, onReorder, onMarkReviewed,
             onStartReUpload, onCancelReUpload, onSubmitReUpload
      (imports statusLabel + itemHasReviewableUpload; no state)

src/app/dashboard/trips/[id]/service-checklist/ServiceChecklistSummary.tsx  ("use client", conditional)
   └─ props: summaries, clientNameById, isPending, triggerRefs, onOpen
      (renders the <ul>; the trigger binds triggerRefs.current[summary.serviceId])

src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx  (shell, < ~300 lines, "use client")
   ├─ props interface unchanged (incl. unused tripId)
   ├─ const checklist = useServiceChecklist({ actions: { getServiceChecklistAction, … } })
   └─ JSX: empty state | section + header | globalError | <ServiceChecklistSummary …> (or inline <ul>)
           | <dialog ref={dialogRef} onClose={handleDialogClose}> header + body
               ├─ detailError | loading live region
               ├─ selectedChecklist.items.map((item, index) =>
               │      <ChecklistItemRow key={item.id} … onReorder={direction =>
               │          handleReorder(selectedChecklist.id, selectedChecklist.items, item.id, direction)} />)
               └─ add-item form (handleAddItem(selectedChecklist.id, event))
```

### Focus / ref ownership (unchanged)

```
useServiceChecklist (one instance, inside the shell)
   ├─ dialogRef ──────────────────────────────► shell renders <dialog ref={dialogRef}
   │                                                  onClose={handleDialogClose}>
   └─ triggerRefs ─────────────────────────────► Summary trigger ref={(el) => {
                                                     triggerRefs.current[serviceId] = el; }}
   handleDialogClose reads triggerRefs.current[serviceId]?.focus()
```

The hook owns the refs; the shell owns the element that consumes `dialogRef`. No child other than the summary writes to `triggerRefs`, and only `handleDialogClose` reads it.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` | Modify | Shell: props interface unchanged, `useServiceChecklist` call, empty state, section/header, global error, summary (or its extraction), the single `<dialog>` element with `onClose={handleDialogClose}`, dialog header/body, row loop, add-item form. Keeps path + export name. Under ~300 lines. |
| `src/app/dashboard/trips/[id]/service-checklist/useServiceChecklist.ts` | Create | `"use client"` hook: action aliases (`:7-30`), pure helpers (`:33-46`), state (`:72-84`), handlers (`:86-197`); returns state + refs + handlers. |
| `src/app/dashboard/trips/[id]/service-checklist/ChecklistItemRow.tsx` | Create | `"use client"` presentational row (`:341-555`): inline edit form, row body, reorder controls, review/re-upload block. |
| `src/app/dashboard/trips/[id]/service-checklist/ServiceChecklistSummary.tsx` | Create (conditional, on measurement) | `"use client"` summary `<ul>` (`:238-275`) with progress counts and the "Documentos" trigger + its ref binding. |
| `src/app/dashboard/trips/[id]/service-checklist/__tests__/checklist-helpers.test.ts` | Create (conditional, the RED) | Plain Vitest pin of `statusLabel` and `itemHasReviewableUpload`; no React render, no new dependency. |
| `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` | Verify | No edit: same 3 tests, same assertions; the split is transparent to them. |
| `src/app/dashboard/trips/[id]/__tests__/page.test.ts` | Verify | No edit: `:13` still finds the literal `"ServiceChecklistManager"` in `page.tsx`. |
| `e2e/local/service-documents.spec.ts` | Verify | No edit: the behavioral net (lazy load, `Contenido del checklist`, `Marcar como revisado`, archived counts, focus return). |
| `src/app/dashboard/trips/[id]/page.tsx` | Verify | No edit: call site (`:773-785`) and the seven bound actions unchanged. |
| `src/app/dashboard/trips/[id]/actions.ts` | Verify | No edit: no signature or binding change. |
| `architecture.md` | Modify/Verify | Add `trips/[id]/service-checklist/` to the folder listing if that listing enumerates nested route folders; otherwise leave untouched and record the decision. |
| `README.md` | Verify | Confirm the truth-source table ("Tecnica (como esta hecho)" → `architecture.md`) needs no edit. |

## Interfaces / Contracts

### `service-checklist/useServiceChecklist.ts`

```ts
"use client";

import type {
  ServiceChecklistItemWithUpload,
  ServiceDocumentSummary,
  ServiceWithChecklist,
} from "@/types";

export type AddChecklistItemAction = (serviceId: string, formData: FormData) => Promise<void>;
export type UpdateChecklistItemAction = (checklistItemId: string, formData: FormData) => Promise<void>;
export type DeleteChecklistItemAction = (checklistItemId: string) => Promise<void>;
export type ReorderChecklistItemsAction = (serviceId: string, orderedIds: string[]) => Promise<void>;
export type MarkUploadReviewedAction = (uploadId: string) => Promise<void>;
export type RequestReUploadAction = (uploadId: string, formData: FormData) => Promise<void>;
export type GetServiceChecklistAction = (serviceId: string) => Promise<ServiceWithChecklist>;

export type ServiceChecklistActions = {
  getServiceChecklistAction: GetServiceChecklistAction;
  addChecklistItemAction: AddChecklistItemAction;
  updateChecklistItemAction: UpdateChecklistItemAction;
  deleteChecklistItemAction: DeleteChecklistItemAction;
  reorderChecklistItemsAction: ReorderChecklistItemsAction;
  markUploadReviewedAction: MarkUploadReviewedAction;
  requestReUploadAction: RequestReUploadAction;
};

/** Pure. Moved verbatim from :33-42; exported for the row and the helper pin. */
export function statusLabel(item: ServiceChecklistItemWithUpload): { icon: string; text: string };

/** Pure. Moved verbatim from :44-46; true only for `uploaded`. */
export function itemHasReviewableUpload(item: ServiceChecklistItemWithUpload): boolean;

export function useServiceChecklist({ actions }: { actions: ServiceChecklistActions }): {
  isPending: boolean;
  globalError: string | null;
  detailError: string | null;
  selectedServiceId: string | null;
  selectedChecklist: ServiceWithChecklist | null;
  editingItemId: string | null;
  reUploadItemId: string | null;
  setEditingItemId: (id: string | null) => void;
  setReUploadItemId: (id: string | null) => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  triggerRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  openChecklist: (serviceId: string) => void;
  closeChecklist: () => void;
  handleDialogClose: () => void;
  handleAddItem: (serviceId: string, event: React.FormEvent<HTMLFormElement>) => void;
  handleUpdateItem: (checklistItemId: string, event: React.FormEvent<HTMLFormElement>) => void;
  handleDeleteItem: (checklistItemId: string) => void;
  handleReorder: (
    serviceId: string,
    items: ServiceChecklistItemWithUpload[],
    checklistItemId: string,
    direction: "up" | "down",
  ) => void;
  handleMarkReviewed: (uploadId: string) => void;
  handleRequestReUpload: (uploadId: string, event: React.FormEvent<HTMLFormElement>) => void;
};
```

Contract: every handler body is byte-identical to today's; `runAction` and `refreshChecklist` may stay internal (not returned). Exactly one `useTransition` is created; `isPending` is that transition's pending flag. The hook renders nothing.

### `service-checklist/ChecklistItemRow.tsx` (client, presentational)

```tsx
export function ChecklistItemRow({
  item, index, itemsLength, isArchived, isPending, isEditing, isRequestingReUpload,
  onStartEdit, onCancelEdit, onSubmitEdit, onDelete, onReorder,
  onMarkReviewed, onStartReUpload, onCancelReUpload, onSubmitReUpload,
}: {
  item: ServiceChecklistItemWithUpload;
  index: number;
  itemsLength: number;
  isArchived: boolean;
  isPending: boolean;
  isEditing: boolean;
  isRequestingReUpload: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onReorder: (direction: "up" | "down") => void;
  onMarkReviewed: () => void;
  onStartReUpload: () => void;
  onCancelReUpload: () => void;
  onSubmitReUpload: (event: React.FormEvent<HTMLFormElement>) => void;
}): React.ReactNode;
```

Contract: no state, no hooks, no data access. Renders the `<li key={item.id}>` wrapper and every class string, `aria-label` (`Mover arriba`, `Mover abajo`, `Editar documento`, `Eliminar documento`), icon, required asterisk, download link, agent comment, disabled conditions (`index === 0`, `index === itemsLength - 1`), review block and re-upload form exactly as today. `item.upload` is read as-is; the review gate uses the imported `itemHasReviewableUpload`.

### `service-checklist/ServiceChecklistSummary.tsx` (client, presentational, conditional)

```tsx
export function ServiceChecklistSummary({
  summaries, clientNameById, isPending, triggerRefs, onOpen,
}: {
  summaries: ServiceDocumentSummary[];
  clientNameById: Record<string, string>;
  isPending: boolean;
  triggerRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onOpen: (serviceId: string) => void;
}): React.ReactNode;
```

Contract: renders the same `<ul>` (`:238-275`) with the same `key`, the same `reviewLabel` singular/plural branch, the same `{summary.processed}/{summary.total} revisados` line and the same trigger button; the trigger keeps its block-body `ref` assignment and its `disabled={isPending}`.

### `ServiceChecklistManager.tsx` (client shell)

Public surface unchanged: named export `ServiceChecklistManager`, same props interface including the unused `tripId: string`. The shell renders the empty state when `summaries.length === 0` (before calling into any render helper), the section/header, the global error, the summary, and exactly one `<dialog ref={dialogRef} onClose={handleDialogClose} aria-labelledby="service-checklist-dialog-title">`.

## Testing Strategy

`strict_tdd: true`. Honest applicability: the split is transparent to the existing component test, so a new failing-first signal exists only for the pure helpers. The change is otherwise verified by the preserved tests as a net.

| Step | What runs | Expected result |
|------|-----------|-----------------|
| RED | `npm run test -- checklist-helpers` after adding the helper pin but before the hook module exists | Fails: the module/export cannot be resolved. Deterministic, no React render. If the pin is rejected, record the applicability exception instead of fabricating a failure. |
| GREEN | Create `useServiceChecklist.ts` with the helpers moved verbatim; `npm run test -- checklist-helpers` | The pin passes and the helpers are unchanged in behavior. |
| TRIANGULATE | `npm run test -- ServiceChecklistManager` (transparent net) + `npm run test -- page` (unchanged pin) | The 3 component tests and the `page.test.ts` assertions stay green with the identical HTML and the unchanged literal. |
| REFACTOR | Re-read the diff for byte-level equivalence of moved blocks; `wc -l` on all four files; re-run `npm run test` | No copy/class/`aria-label`/branch drift; every file under ~300 lines; full unit suite green. |
| E2E | `npm run test:e2e -- --project=local` with the Supabase stack up | `service-documents.spec.ts` green, including `Escape` → `documentsButton` focused, review counts, archived-trip control removal. |

| Layer | What verifies | Approach |
|-------|---------------|----------|
| Unit (pure pin) | `statusLabel` status→icon/text and `itemHasReviewableUpload` | new `service-checklist/__tests__/checklist-helpers.test.ts` (the RED) |
| Unit (component) | Identical rendered HTML, one dialog, archived controls removed | existing `ServiceChecklistManager.test.tsx`, unmodified |
| Unit (structural) | The literal `"ServiceChecklistManager"` still appears in `page.tsx` | existing `page.test.ts`, unmodified |
| E2E (local) | Lazy load, dialog label/scroll, focus return, review/add flows, archived trip | existing `e2e/local/service-documents.spec.ts`, unmodified |
| Type/build | Hook return shape, row/summary prop shapes, `"use client"` placement | `npx tsc --noEmit`, `npm run build`, `npm run lint` |
| Size | Every file under budget | `wc -l` over the shell + `service-checklist/*` |

## Threat Matrix

N/A — this change introduces no shell/CLI routing, subprocess execution, VCS/PR automation, executable classification, or process-integration edge. It is a static JSX/state move inside one App Router route, with no inputs, network calls, or new execution surface. No matrix row applies and no RED tests are fabricated from it.

## Migration / Rollout

- **Data/schema**: no migrations. Nothing under `supabase/migrations/` or `supabase/seed.sql` changes.
- **Rollout**: single PR; the effect is internal only. No feature flag needed because behavior is unchanged.
- **Compatibility**: the component path, export name, props interface, Server Action bindings, trigger `ref` behavior, dialog element identity and every rendered string are preserved. `src/lib/data*` and `actions.ts` are untouched.
- **Rollback**: revert the commits; delete `service-checklist/`; `ServiceChecklistManager.tsx` returns to its pre-refactor version. The tests were never modified, so no test revert is needed.
- **Docs**: `architecture.md` is the technical source of truth; add `trips/[id]/service-checklist/` to the folder listing if it enumerates nested route folders, and verify the `README.md` truth-source table in the same PR.
- **Note on PR sequencing**: PR 2 (`refactor-ui-trip-editor-sections`) also edits the `trips/[id]/` region of the `architecture.md` listing (adding `sections/`). If both land, keep each added line and do not reorder existing entries, to keep the merge conflict minimal.

## Open Questions

- [ ] Should the pure helpers live inside `useServiceChecklist.ts` (orchestrator's decision) or in a tiny sibling `checklist-status.ts`? Proposed: inside the hook module, exported for the row and the pin — one fewer file and one owner, at the cost of importing a `"use client"` module from a test.
- [ ] Should `ServiceChecklistSummary.tsx` always be extracted for symmetry with the row, or only when measurement requires it? Proposed: measurement decides (D4); extract if the shell exceeds ~300 lines after the row extraction.
- [ ] Should the helper pin (`checklist-helpers.test.ts`) be part of this PR, or is the existing component/e2e net sufficient? Proposed: include it — it is the change's only honest RED and costs one small test file and no dependency.
- [ ] Should the unused `tripId` prop be removed now? Proposed: no — keep it and record it as follow-up cleanup, so the call site and the component test stay untouched in this pure move.
- [ ] If the shell still exceeds budget after the summary extraction, extract a `ServiceChecklistDetail` child (detailError + loading + rows + add-item form) or accept ~300? Proposed: extract the detail child; do not accept a partial split.

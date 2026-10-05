# Service Checklist Modularity Specification

## Purpose

Keep the service checklist surface's rendered behavior, markup, testids, labels and copy identical while reducing `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` (596 lines) to a shell under ~300 lines. The state and handler logic moves into a co-located custom hook, the per-item row (and, when measurement requires it, the summary list) becomes a presentational child, and the shell keeps ownership of the single native `<dialog>` element and the focus/ref contract. This is a pure refactor: no behavior, design, markup, copy, or assertion change.

Baseline: `baseline-from-current-implementation` — every requirement below describes behavior that already exists today and MUST remain observable-equivalent after the split (issue #373, PR 3 of 4).

Scope: `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` and the new modules under `src/app/dashboard/trips/[id]/service-checklist/`, plus the technical documentation in `architecture.md`. `src/app/dashboard/trips/[id]/page.tsx`, `src/app/dashboard/trips/[id]/actions.ts`, `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx`, `src/app/dashboard/trips/[id]/__tests__/page.test.ts` and `e2e/local/service-documents.spec.ts` are untouched.

## Requirements

### Requirement: Single-owner dialog and focus contract

The native `<dialog>` element, its `ref`, the per-`serviceId` trigger-ref map, and the `onClose` handler MUST have exactly one owner: the `ServiceChecklistManager` shell that instantiates the hook. Closing the dialog — including via `Escape`, which fires the native `onClose` — MUST reset `selectedServiceId`, `selectedChecklist`, `editingItemId` and `reUploadItemId`, and MUST return focus to the trigger button of the closed `serviceId` when one is registered.

#### Scenario: Focus returns to the trigger after Escape

- GIVEN the summary button for a `serviceId` is rendered and has registered its element in the trigger-ref map
- WHEN the dialog is open and the user presses `Escape`
- THEN the dialog MUST close via the native `onClose` path
- AND `triggerRefs.current[serviceId]` MUST receive focus

#### Scenario: Single dialog element

- GIVEN the component test asserts one accessible dialog
- WHEN the refactored surface renders
- THEN exactly one `<dialog>` element MUST be produced
- AND it MUST keep `aria-labelledby="service-checklist-dialog-title"` and the same class string

#### Scenario: Refs are not split across owners

- GIVEN the dialog `ref` and the trigger-ref map
- WHEN the extracted modules are inspected
- THEN the `<dialog>` element MUST be rendered only by `ServiceChecklistManager.tsx`
- AND no child component MUST own a second dialog or a second trigger-ref map

### Requirement: State and handlers owned by a custom hook

The state and the handler cluster MUST live in a co-located `"use client"` hook, `useServiceChecklist`, that renders nothing. The hook MUST create the router, the dialog ref, the trigger-ref map, exactly one `useTransition`, and the `globalError`, `detailError`, `selectedServiceId`, `selectedChecklist`, `editingItemId` and `reUploadItemId` state. It MUST expose the open/close/dialog-close handlers, the add/update/delete/reorder handlers, the mark-reviewed and request-re-upload handlers, the refs, and the state needed to render. No `useEffect` MUST be introduced.

#### Scenario: Hook owns the state contract

- GIVEN the current component state: `router`, `dialogRef`, `triggerRefs`, `isPending`/`startTransition`, `globalError`, `detailError`, `selectedServiceId`, `selectedChecklist`, `editingItemId`, `reUploadItemId`
- WHEN the refactor lands
- THEN all of them MUST be created inside `useServiceChecklist`
- AND the hook MUST return them (or their setters) for the shell to render and to clear

#### Scenario: `runAction` remains the single action chokepoint

- GIVEN `runAction(action, refreshServiceId?)` clears `globalError`, opens a transition, awaits the action, optionally re-fetches the checklist, then calls `router.refresh()`, and on error sets `globalError`
- WHEN the hook is reviewed
- THEN every mutation handler (add, update, delete, reorder, mark reviewed, request re-upload) MUST route through that single `runAction`
- AND no handler MUST bypass it with a direct `startTransition` call

#### Scenario: Lazy load is preserved with no effect

- GIVEN the checklist detail is fetched only when a traveler is opened
- WHEN `openChecklist(serviceId)` runs
- THEN it MUST call `dialogRef.current?.showModal()` and start a transition that fetches the checklist for that `serviceId`
- AND the hook MUST NOT register a `useEffect`

### Requirement: Presentational row with unchanged markup, testids and copy

The per-item row MUST be extracted into a `"use client"` presentational component that receives the item, its index and length, the flags, the shared `isPending`, and callbacks. It MUST hold no state and MUST render the row markup byte-for-byte: the same class strings, the same `aria-label`s (`Mover arriba`, `Mover abajo`, `Editar documento`, `Eliminar documento`), the same status icon/text, the same required asterisk, the same download link and agent-comment branch, the same inline edit form, the same review/re-upload block, and the same disabled conditions.

#### Scenario: Row markup moved, not rewritten

- GIVEN the row JSX from the inline edit form through the review/re-upload block
- WHEN it is compared with the deleted block in `ServiceChecklistManager.tsx`
- THEN the class strings, copy, order, `key`, `aria-label`s and conditional branches MUST be unchanged
- AND the `statusLabel` icon/text and the `itemHasReviewableUpload` review gate MUST produce the same output for the same item

#### Scenario: Reorder controls keep their disabled bounds

- GIVEN a row at index `0` and a row at index `itemsLength - 1`
- WHEN the row renders
- THEN the "Mover arriba" button MUST be disabled at index `0`
- AND the "Mover abajo" button MUST be disabled at the last index
- AND both MUST be disabled while `isPending` is true

#### Scenario: Archived rows keep every mutation gate

- GIVEN `isArchived` is true
- WHEN the row renders
- THEN the reorder controls, the inline edit, the delete control, the review block and the re-upload form MUST NOT render
- AND the label, status text and upload filename MUST still render

#### Scenario: Event and confirm semantics unchanged

- GIVEN the edit and re-upload forms and the delete control
- WHEN the row submits or deletes
- THEN the handler MUST still call `event.preventDefault()` and read `event.currentTarget`
- AND delete MUST still go through `confirm("¿Eliminar este item del checklist?")`

### Requirement: Presentational summary with unchanged markup and trigger binding

When the shell needs budget headroom, the per-client summary `<ul>` MUST be extracted into a `"use client"` presentational component that receives `summaries`, `clientNameById`, the shared `isPending`, the trigger-ref map and an open callback. It MUST render the same list item structure, the same singular/plural review label, the same `processed/total revisados` copy, and the same "Documentos" trigger, including its block-body `ref` assignment and its `disabled={isPending}` state.

#### Scenario: Summary content identical

- GIVEN two summaries with `awaitingReview` 1 and 0
- WHEN the summary renders
- THEN the first MUST show `pendiente de revisión` (singular) and the second MUST omit the suffix
- AND both MUST show `{processed}/{total} revisados` exactly as today

#### Scenario: Trigger ref registration preserved

- GIVEN the "Documentos" trigger
- WHEN the summary renders
- THEN it MUST assign `triggerRefs.current[summary.serviceId]` through a block-body `ref` callback that returns no value
- AND clicking it MUST call `openChecklist(summary.serviceId)`

### Requirement: Single shared transition

The surface MUST create exactly one `useTransition`. Its `isPending` flag MUST be shared by the summary trigger, every row control, the forms and the dialog controls through props. The change MUST NOT introduce a second transition, a `useOptimistic`, or a per-row pending state.

#### Scenario: One transition instance

- GIVEN the refactored modules
- WHEN they are searched for `useTransition`
- THEN it MUST appear exactly once, inside `useServiceChecklist`
- AND every consumer MUST receive `isPending` as a prop rather than creating its own transition

#### Scenario: Pending state stays coherent

- GIVEN an in-flight mutation started from one row
- WHEN `isPending` becomes true
- THEN the summary trigger and every row control MUST disable together, as they do today

### Requirement: Hook/presentation boundary and file-size budget

`ServiceChecklistManager.tsx` MUST keep its path and its named export, and MUST become a shell that wires the hook and composes the dialog, summary and rows. Every file in the surface — the shell, the hook, the row, and the summary if extracted — MUST be under ~300 lines. The action type aliases and the two pure helpers MUST live with the hook that consumes them.

#### Scenario: Shell budget met

- GIVEN the final diff
- WHEN line counts are measured with `wc -l` for `ServiceChecklistManager.tsx` and every file under `service-checklist/`
- THEN the shell MUST be under ~300 lines
- AND every new file MUST be under ~300 lines

#### Scenario: Public surface preserved

- GIVEN `page.tsx` imports `ServiceChecklistManager` and `page.test.ts` asserts the literal `"ServiceChecklistManager"`
- WHEN the refactor lands
- THEN the component's path and named export MUST be unchanged
- AND its props interface MUST accept the same props, including the accepted-but-unused `tripId`

#### Scenario: Client directive convention respected

- GIVEN the extracted modules are imported by a client component
- WHEN their first line is inspected
- THEN the hook and each extracted `.tsx` MUST carry `"use client"`, matching the existing `src/components/item-form/*` precedent

### Requirement: Pure refactor with no observable change

The change MUST be limited to module boundaries and file placement. It MUST NOT alter observable behavior, copy, validation, styling, markup order, the optimistic client-side reorder over the live items array, the `window.confirm` prompt, the `event.currentTarget` form handling, or any existing assertion. The `page.tsx` call site and its seven bound actions MUST remain unchanged.

#### Scenario: Call-site contract intact

- GIVEN `page.tsx:773-785` passes `tripId`, `summaries`, `clientNameById`, `isArchived` and seven bound actions
- WHEN the refactor lands
- THEN the call site MUST NOT be edited
- AND each bound action MUST reach the same handler it reaches today

#### Scenario: Reorder stays optimistic over the live array

- GIVEN `handleReorder` finds the index in the items array it receives, swaps a copy, and sends the ordered ids
- WHEN a row's reorder control is used
- THEN the handler MUST receive the live `selectedChecklist.items` reference from the current render
- AND no memoization or cloning MUST be introduced that could hand it a stale array

#### Scenario: Size exception documented

- GIVEN the extraction moves roughly 500 lines out of a 596-line component
- WHEN the proposal and design are reviewed
- THEN the proposal MUST state the >400 changed-lines exception, the expected magnitude, and the single-PR decision
- AND the design MUST record why chained PRs were considered and rejected, and give reviewer guidance for reading a pure-move diff

### Requirement: Existing pins preserved as the behavioral net

The existing tests MUST remain unmodified and green, and the RED/GREEN assessment MUST be honest. `ServiceChecklistManager.test.tsx` (3 tests: progress counts without fetching, one accessible dialog, archived controls removed) is transparent to the split and serves as the net, not as a RED. `page.test.ts:13` keeps its literal assertion. The local e2e spec remains the behavioral net for lazy load, focus return and the review/add flows.

#### Scenario: Component test unchanged

- GIVEN `ServiceChecklistManager.test.tsx` renders with `renderToStaticMarkup` and asserts the produced HTML
- WHEN the split lands
- THEN that file MUST NOT be modified
- AND all three tests MUST pass with the identical HTML

#### Scenario: Honest RED recorded

- GIVEN the split is transparent to the component test
- WHEN the change documents its TDD evidence
- THEN it MUST either record a deterministic RED from a pure-helper pin (`statusLabel`, `itemHasReviewableUpload`)
- OR state the applicability exception explicitly, without claiming a RED that was never observed

#### Scenario: Structural pin untouched

- GIVEN `page.test.ts` asserts the literal `"ServiceChecklistManager"` in `page.tsx`
- WHEN the refactor lands
- THEN `page.test.ts` MUST NOT be modified
- AND its assertion MUST still pass

#### Scenario: E2E focus and flow contract intact

- GIVEN `e2e/local/service-documents.spec.ts` covers lazy load, `getByLabel("Contenido del checklist")`, `Escape` → `documentsButton` focused, "Marcar como revisado" count updates, adding a requested document, and archived-trip control removal
- WHEN the local e2e project runs
- THEN the spec MUST pass without edits

### Requirement: Full verification battery green

The refactor MUST pass the repository's full verification battery: typecheck, lint, unit tests, production build, and the local Playwright project with the Supabase stack up. The change MUST NOT be reported complete while any of these required commands fails, unless the failure is a known pre-existing environmental failure named as such.

#### Scenario: Static and unit checks

- GIVEN the refactored shell, hook, row and summary
- WHEN `npx tsc --noEmit`, `npm run lint` and `npm run test` run
- THEN all three MUST pass
- AND no lint error MUST be introduced in the changed files

#### Scenario: Build and end-to-end checks

- GIVEN a clean production build and a running local Supabase stack
- WHEN `npm run build` and `npm run test:e2e -- --project=local` run
- THEN the build MUST be clean
- AND the local e2e suite MUST pass, exercising the service-documents flow

#### Scenario: Verification reported per command

- GIVEN the verification phase is complete
- WHEN the change is handed off
- THEN each command MUST be reported with its exact command line and observed result
- AND any pre-existing failure not caused by this change MUST be named explicitly instead of being silently absorbed

### Requirement: Documentation source of truth checked

The `README.md` truth-source table (`architecture.md` is the technical source of truth) MUST be verified. The `architecture.md` folder listing that enumerates `trips/[id]/` and its nested route folders MUST be updated when introducing the co-located `trips/[id]/service-checklist/` folder ages that listing.

#### Scenario: Folder listing freshness

- GIVEN the `architecture.md` listing that enumerates `trips/[id]/` and `trips/[id]/quote/`
- WHEN the refactor lands
- THEN the listing MUST include `trips/[id]/service-checklist/` if it enumerates nested route folders
- AND `architecture.md` MUST be left untouched and the decision recorded if no listed entry aged

#### Scenario: Truth-source table verified

- GIVEN the `README.md` truth-source table row mapping technical topics to `architecture.md`
- WHEN the change is reviewed
- THEN that row MUST be verified as still accurate
- AND `README.md` MUST be left unchanged unless the row aged

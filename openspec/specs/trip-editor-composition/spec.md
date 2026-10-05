# Trip Editor Composition Specification

## Purpose

Keep the trip editor's rendered behavior, markup, and data loading identical while reducing `src/app/dashboard/trips/[id]/page.tsx` (870 lines) to a composer under ~300 lines. The page's presentation moves into co-located Server Component sections under `src/app/dashboard/trips/[id]/sections/`, the shared module helpers move to a co-located non-JSX module, and the structural pin test is repointed at the new locations with its original assertions. This is a pure refactor: no behavior, design, markup, copy, or assertion change.

Baseline: `baseline-from-current-implementation` — every requirement below describes behavior that already exists today and MUST remain observable-equivalent after the split (issue #373, PR 2 of 4).

Scope: `src/app/dashboard/trips/[id]/page.tsx`, `src/app/dashboard/trips/[id]/sections/*`, `src/app/dashboard/trips/[id]/__tests__/page.test.ts`, and the technical documentation in `architecture.md`. `src/app/dashboard/trips/[id]/actions.ts` and every client dialog are untouched.

## Requirements

### Requirement: Page as bounded composer

`src/app/dashboard/trips/[id]/page.tsx` MUST keep ownership of data loading, environment flags, cross-section derived values, and Server Action bindings, and MUST delegate presentation to the extracted sections. After the refactor the page MUST be under ~300 lines. The page MUST NOT introduce component state, and MUST NOT add or remove data reads.

#### Scenario: Data loading preserved

- GIVEN the page currently awaits seven `@/lib/data` reads through one `Promise.all`, then `getTripFeedback`, then one `getDailyWeather` call per day
- WHEN the refactored page renders
- THEN it MUST issue the same reads with the same arguments on the same request
- AND the `notFound()` behavior when the trip does not exist MUST stay after the trip read and before the feedback read.

#### Scenario: Cross-section derived values computed once in the page

- GIVEN `dayOrder`, `tripDateRangeDays`, `completeness`, `totalCost`, `hasAnyCost`, `budgetDiff`, `isPublished`, `isEditable`, and `travelerHref`
- WHEN the sections render
- THEN these values MUST be computed in the page and passed as props
- AND only per-day `itemOrder` MAY be derived inside `DayCard` from its own `day` prop.

#### Scenario: Page size budget met

- GIVEN the final diff
- WHEN line counts are measured for `page.tsx` and every file under `sections/`
- THEN `page.tsx` MUST be under ~300 lines
- AND every section file MUST be under ~300 lines.

### Requirement: Sections are Server Components with identical markup

Every extracted section MUST be a Server Component with no `"use client"` directive, receiving props and rendering JSX. Each section MUST reproduce the markup it owns byte-for-byte: the same class strings, text content, DOM order, React `key`s, `id`s, and conditional branches as the pre-refactor page.

#### Scenario: No new client boundary

- GIVEN the refactor diff
- WHEN the new files under `sections/` are inspected
- THEN none of them MUST contain a `"use client"` directive
- AND no new client component MUST be introduced by this change.

#### Scenario: Markup moved, not rewritten

- GIVEN the header/publish block, the published-lock banner, the left days nav, the day cards with their item rows, and the right rail cards
- WHEN each is compared with the deleted block in `page.tsx`
- THEN the class strings, copy, order, `key`s, and `id`s MUST be unchanged
- AND the corporate burgundy/gold classes (`bg-[#4a1834]`, `border-[#f0bd79]/35`, `bg-[#fdf7f3]`, `mt-1 text-sm text-[#f7dfbc]`) MUST still be rendered by the trip editor surface.

#### Scenario: Module helpers extracted to a co-located module

- GIVEN the `statusMeta` status map and `countDaysInRange`
- WHEN the refactor lands
- THEN both MUST live in `sections/trip-editor-meta.ts` with unchanged values and signature
- AND the page and the sections that use them MUST import from that module.

#### Scenario: Conditional branches preserved

- GIVEN `isEditable`, `trip.days.length`, `day.notes`, `day.items.length`, `trip.statusHistory.length`, `feedback.length`, and `tripDateRangeDays !== null`
- WHEN the sections render for each combination
- THEN the same elements MUST render in the same conditions as today (published-lock copy, empty-day message, notes block, status-history card, feedback card, generate-days button)
- AND the mobile add-day row MUST remain hidden on large viewports exactly as before.

### Requirement: Bound Server Action threading unchanged

The page MUST keep every `action.bind(...)` expression and MUST pass the resulting bound actions to the sections that render them. Sections MUST NOT create their own bindings from `./actions`. Every client dialog MUST receive the same bound action it receives today for the same trip, day, item, document, photo, or checklist entity.

#### Scenario: Bindings stay in the page

- GIVEN the ~48 Server Actions imported from `./actions`
- WHEN a section that renders a dialog form is reviewed
- THEN the bound action it passes MUST originate from a page-level `action.bind(...)` expression
- AND the section MUST NOT import `./actions` to construct that binding.

#### Scenario: Dialog props unchanged

- GIVEN the client dialogs rendered by the editor (`DayFormDialog`, `ItemFormDialog`, `MoveItemToDayDialog`, `DuplicateItemDialog`, `TripClientsManager`, `TripTagsManager`, `TripBudgetDialog`, `TripCurrencyDialog`, `TripCommissionDialog`, `TripTravelerCountDialog`, `TripInstructionsDialog`, `TripInternalNotesDialog`, `SaveAsTemplateDialog`, `DeleteTripDialog`, `PackingListManager`, `TripCoverImage`, `TripPhotoGallery`, `TripDocuments`, `ServiceChecklistManager`)
- WHEN the refactor lands
- THEN each MUST receive the same props and the same bound actions as before
- AND no dialog public prop MUST be renamed, added, or removed.

#### Scenario: Service checklist wiring intact

- GIVEN `ServiceChecklistManager` receives `tripId`, `summaries`, `clientNameById`, `isArchived`, and nine bound checklist actions
- WHEN it renders from the extracted rail section
- THEN it MUST receive the same `summaries` and `isArchived={trip.status === "archived"}` value
- AND all nine bound actions MUST be passed unchanged.

### Requirement: Editor trigger ids preserved

The two trigger ids consumed by `TripEditorShortcuts` MUST remain on exactly the same buttons, each owned by exactly one element. `ADD_DAY_TRIGGER_ID` MUST stay on the left-aside "+ Agregar día" trigger inside the add-day dialog. `ADD_ITEM_LAST_DAY_TRIGGER_ID` MUST stay on the "+ Agregar item a este día" trigger of the last day only. The mobile add-day button MUST NOT carry an id.

#### Scenario: Add-day shortcut target preserved

- GIVEN `TripEditorShortcuts` reads `document.getElementById(ADD_DAY_TRIGGER_ID)`
- WHEN the left days nav renders
- THEN exactly one button MUST carry `ADD_DAY_TRIGGER_ID`
- AND that button MUST be the trigger of the add-day `DayFormDialog`.

#### Scenario: Last-day add-item shortcut target preserved

- GIVEN `TripEditorShortcuts` reads `document.getElementById(ADD_ITEM_LAST_DAY_TRIGGER_ID)`
- WHEN the last day card renders with `isEditable` true
- THEN exactly one add-item trigger MUST carry `ADD_ITEM_LAST_DAY_TRIGGER_ID`
- AND no other day card MUST carry it.

#### Scenario: Shortcut hosts stay page-level

- GIVEN `TripEditorShortcuts` and `UndoToastHost`
- WHEN the page composes the sections
- THEN both MUST remain rendered by `page.tsx`
- AND they MUST NOT be moved into a section.

### Requirement: Structural pin test repointed with the same assertions

`src/app/dashboard/trips/[id]/__tests__/page.test.ts` MUST be updated to read `page.tsx` together with the extracted `sections/*.tsx` files. The assertion set MUST be preserved exactly: the same seven `toContain` assertions, none added, removed, or weakened.

#### Scenario: Same assertions, new read set

- GIVEN the current test asserting `bg-[#4a1834]`, `border-[#f0bd79]/35`, `bg-[#fdf7f3]`, `mt-1 text-sm text-[#f7dfbc]`, `TripPublishSubmitButton`, `ServiceChecklistManager`, and the copy `Las acciones de edición están bloqueadas mientras el viaje está publicado.`
- WHEN the updated test runs after the extraction
- THEN all seven assertions MUST still execute and pass against the page plus the section files
- AND no assertion MUST have been deleted or narrowed.

#### Scenario: RED before the sections exist

- GIVEN the updated test that reads the section files
- WHEN it runs before those files are created
- THEN it MUST fail because the section files cannot be read
- AND that failure MUST be recorded as the RED step before the extraction.

#### Scenario: Unrelated editor tests untouched

- GIVEN `__tests__/actions.test.ts` and `__tests__/ServiceChecklistManager.test.tsx`
- WHEN the refactor lands
- THEN neither file MUST be modified
- AND both MUST still pass.

### Requirement: Pure refactor with documented size exception

The change MUST be limited to module boundaries and file placement. It MUST NOT alter observable behavior, copy, validation, styling, markup order, or existing assertions. Because the mechanical move exceeds the ~400 changed-lines guideline in `architecture.md`, the exception MUST be documented in the change artifacts together with the single-PR decision and its rationale.

#### Scenario: Observable behavior intact

- GIVEN the refactor diff
- WHEN the unit and local e2e suites run
- THEN no existing assertion about behavior, texts, states, day/item ordering, publishing, finance, documents, feedback, or checklist handling MUST have been removed or weakened
- AND `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e -- --project=local` (Supabase stack up) MUST pass.

#### Scenario: Size exception documented

- GIVEN the extraction moves ~660 JSX lines out of `page.tsx`
- WHEN the proposal and design are reviewed
- THEN `proposal.md` MUST state the >400 changed-lines exception, the expected magnitude, and the single-PR decision
- AND `design.md` MUST record why chained PRs were considered and rejected, and give reviewer guidance for reading a pure-move diff.

#### Scenario: No unrelated surface modified

- GIVEN the planned change set
- WHEN the final diff is inspected
- THEN only `page.tsx`, the new files under `sections/`, `page.test.ts`, and (only if it aged) `architecture.md` MUST have changed
- AND `actions.ts`, `ServiceChecklistManager.tsx`, `src/lib/data*`, and the client dialogs MUST be unmodified.

### Requirement: Full verification battery green

The refactor MUST pass the repository's full verification battery for this route: typecheck, lint, unit tests, production build, and the local Playwright project with the Supabase stack up. The change MUST NOT be reported complete while any of these required commands fails, unless the failure is a known pre-existing environmental failure named as such.

#### Scenario: Static and unit checks

- GIVEN the refactored page and the new section files
- WHEN `npx tsc --noEmit`, `npm run lint`, and `npm run test` run
- THEN all three MUST pass
- AND no lint error MUST be introduced in the changed files.

#### Scenario: Build and end-to-end checks

- GIVEN a clean production build and a running local Supabase stack
- WHEN `npm run build` and `npm run test:e2e -- --project=local` run
- THEN the build MUST be clean
- AND the local e2e suite MUST pass, exercising the editor flows that depend on this page (publish toggle, day/item CRUD, documents, checklist, traveler activities, visibility links).

#### Scenario: Verification reported per command

- GIVEN the verification phase is complete
- WHEN the change is handed off
- THEN each command MUST be reported with its exact command line and observed result
- AND any pre-existing failure not caused by this change MUST be named explicitly instead of being silently absorbed.

### Requirement: Documentation source of truth checked

The `README.md` truth-source table (`architecture.md` is the technical source of truth) MUST be verified. The `architecture.md` folder listing that enumerates `trips/[id]/` and its nested route folders MUST be updated when that listing ages by introducing `trips/[id]/sections/`.

#### Scenario: Folder listing freshness

- GIVEN the `architecture.md` listing that enumerates `trips/[id]/` and `trips/[id]/quote/`
- WHEN the refactor lands
- THEN the listing MUST include `trips/[id]/sections/` if it enumerates nested route folders
- AND `architecture.md` MUST be left untouched and the decision recorded if no listed entry aged.

#### Scenario: Truth-source table verified

- GIVEN the `README.md` truth-source table row mapping technical topics to `architecture.md`
- WHEN the change is reviewed
- THEN that row MUST be verified as still accurate
- AND `README.md` MUST be left unchanged unless the row aged.

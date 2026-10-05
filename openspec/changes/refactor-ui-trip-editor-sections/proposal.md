# Proposal: Split `trips/[id]/page.tsx` into co-located editor sections

**Change slug:** `refactor-ui-trip-editor-sections`
**Issue:** [#373 — Reducir los componentes sobredimensionados del editor de viaje y dashboard](https://github.com/eliumontoya/travelhub-app/issues/373) (PR 2 of 4)
**Phase:** propose
**Status:** ready for spec + design

## Intent

`src/app/dashboard/trips/[id]/page.tsx` is 870 lines and is the second of four oversized files called out by issue #373. A single Server Component currently plays four unrelated roles at once:

1. **Data loading** — `Promise.all` over seven `@/lib/data` reads (`:134-155`), plus `getTripFeedback` (`:143`) and one `getDailyWeather` call per day (`:161`).
2. **Derived aggregates** — `dayOrder` (`:157`), `tripDateRangeDays` (`:158`), `completeness` (`:159`), `totalCost`/`hasAnyCost`/`budgetDiff` (`:163-172`), `isPublished`/`isEditable`/`travelerHref` (`:173-175`).
3. **Module helpers** — the `statusMeta` status-color map (`:44-48`) and `countDaysInRange` (`:862-870`), both used in more than one region of the render.
4. **~660 lines of JSX** composing the back link (`:166`), header/publish block (`:168-221`), published-lock banner (`:223-227`), a three-column grid (`:229`) with left days nav (`:231-283`), the day-card itinerary (`:285-~590`), and the right rail of trip actions, finance, completeness, media, service checklist, status history, feedback, packing and danger zone (`:592-~850`), closing with `TripEditorShortcuts` and `UndoToastHost` (`:858-859`).

The size makes the file hard to review and to change: a finance tweak, a day-card tweak, and a header tweak all touch the same 870-line surface, and the co-located structural pin test (`__tests__/page.test.ts`) is coupled to that same blob. The goal is a **pure refactor** — zero behavior and zero design change — that turns the page into a composer under ~300 lines and moves the JSX into co-located section components under `sections/`, each under ~300 lines. One PR.

### Evidence

- The page is an `async` Server Component with **zero `useState`/`useEffect`**. All interactivity already lives in client children (`ItemFormDialog`, `DayFormDialog`, `TripClientsManager`, `ServiceChecklistManager`, `TripEditorShortcuts`, `UndoToastHost`, …). "Push state down" is already the de facto situation; what remains is composition.
- ~48 bound Server Actions are imported from the co-located `./actions` (`:70-121`) and passed to client children. No action is called directly in JSX beyond `form action={…}` bindings.
- Env flags `documentsEnabled` / `photosEnabled` / `coversEnabled` are module-level (`:50-53`) and stay at module level.
- Module-level helpers `statusMeta` (`:44-48`) and `countDaysInRange` (`:862-870`) are consumed by more than one render region (header + status history; days nav + mobile add-day row).
- Two stable trigger ids are consumed by `TripEditorShortcuts`: `ADD_DAY_TRIGGER_ID` on the left-aside add-day button (`:268`) and `ADD_ITEM_LAST_DAY_TRIGGER_ID` on the last day's add-item button.
- **Structural test risk:** `src/app/dashboard/trips/[id]/__tests__/page.test.ts` (16 lines) reads `page.tsx` as **raw text** and asserts class strings, component names, and banner copy. Those strings are distributed across the new section files, so the test MUST be updated to read the section files while keeping the exact same assertion set. `actions.test.ts` and `ServiceChecklistManager.test.tsx` are unaffected.
- Behavioral nets already exist: the local Playwright suite covering the trip editor (e.g. `e2e/local/dashboard.spec.ts:59-102`, `e2e/local/service-documents.spec.ts:29,70`, `e2e/local/traveler-activities.spec.ts:110,182`, `e2e/local/trip-visibility.spec.ts:48-63`).
- Precedent for co-located route components already exists: `src/app/dashboard/clients/ClientsExplorer.tsx`, `src/app/dashboard/trips/TripsExplorer.tsx`, `src/app/dashboard/wcc/components.tsx`.

## Scope

### In Scope

- Extract the page's JSX into co-located Server Components under `src/app/dashboard/trips/[id]/sections/`:
  - `TripHeaderSection.tsx` — header, status badge, tags, publish form (`TripPublishSubmitButton`), preview/quote links, `CopyUrlButtonClient` / `ShareWhatsAppButton` when published, and the published-lock banner.
  - `DaysNavSection.tsx` — the left aside: day anchors, `DayFormDialog` (+ Agregar día, carrying `ADD_DAY_TRIGGER_ID`), `GenerateDaysButton`.
  - `ItinerarySection.tsx` — the center column shell: "Itinerario por días" card, "Ir al último día" link, the day list, and the mobile add-day row.
  - `DayCard.tsx` — one day card: date header, `WeatherBadge`, day reorder/edit controls, day notes, item rows (with flight badge, location, cost, confirmation, metadata summary, `LocationActions`), the empty-day message, and the add-item dialog carrying `ADD_ITEM_LAST_DAY_TRIGGER_ID` on the last day.
  - `TripSidebarActionsSection.tsx` — "Acciones" (including the published-lock copy), "Finanzas", "Completitud".
  - `TripSidebarDetailsSection.tsx` — cover image, photo gallery, trip documents, `ServiceChecklistManager`, status history, feedback, packing list, danger zone.
- Move `statusMeta` and `countDaysInRange` into `src/app/dashboard/trips/[id]/sections/trip-editor-meta.ts`, imported by the page and the sections that need them.
- Update `src/app/dashboard/trips/[id]/__tests__/page.test.ts` so the **same seven assertions** run against the union of `page.tsx` and the new section files. No assertion is added, removed, or weakened.
- Update `architecture.md` if its folder listing (which enumerates `trips/[id]/` and nested route folders) ages.
- Record the size exception required by `architecture.md` ("si una extracción supera ~400 líneas cambiadas, documentar la excepción o partirla") in this proposal.

### Out of Scope

- Any behavior, copy, validation, styling, markup, DOM-order, class-string, or assertion change. The refactor is observably neutral.
- Any new client component, any `"use client"` directive, or any new state. Every extracted section stays a Server Component and receives bound actions as props.
- Any change to `src/app/dashboard/trips/[id]/actions.ts`, `ServiceChecklistManager.tsx`, `src/lib/data*`, or `src/lib/item-meta.ts`.
- Any call-site, prop-shape, or trigger-id change for the client dialogs rendered by the sections.
- The other three issue #373 files (`ItemFormDialog.tsx` — already shipped as PR #410; `ServiceChecklistManager.tsx`; `DashboardFilters.tsx`); each gets its own change and PR.
- New dependencies, new global state, or moving data loading out of the page.

## Capabilities

> This section is the CONTRACT between proposal and specs.

### New Capabilities

- `trip-editor-composition`: the trip editor page is a bounded composer, its presentation lives in co-located Server Component sections that render observably identical markup and behavior, bound Server Actions and trigger ids are threaded unchanged, the structural pin test covers the new composition with its original assertions, and no file in the trip-editor surface exceeds the ~300-line budget. Covers `src/app/dashboard/trips/[id]/page.tsx`, `src/app/dashboard/trips/[id]/sections/*`, and the `trips/[id]/` entry in `architecture.md`.

### Modified Capabilities

- None. This change is a pure refactor and does not alter the observable contract of any domain capability (itinerary editing, publishing, finance, documents, feedback). Only the internal module boundaries change.

## Approach

1. **Update the structural pin first (TDD RED).** `page.test.ts` is the only automated test that will break: it reads `page.tsx` as raw text. Update it to read `page.tsx` plus the new `sections/*.tsx` files and keep the exact same assertion set. Run `npm run test -- page` and observe RED (`readFileSync` fails because the section files do not exist yet).
2. **Move the module helpers.** Create `sections/trip-editor-meta.ts` with `statusMeta` and `countDaysInRange` moved verbatim (`:44-48`, `:862-870`); import them from the page and from the sections that use them.
3. **Extract the sections without touching behavior.** Move JSX verbatim, in render order, keeping every class string, text, `id`, `key`, and bind expression byte-identical. Sections are Server Components (`async`/sync functions with no directive) that receive exactly what they render from the page.
4. **Keep cross-section derivations in the page.** `totalCost`, `hasAnyCost`, `budgetDiff`, `completeness`, `dayOrder`, `tripDateRangeDays`, `isEditable`, `travelerHref` stay in the page and arrive as props; `itemOrder` may be derived inside `DayCard` from its own `day` prop because it does not cross sections. This avoids recomputation drift and keeps a single source for each aggregate.
5. **Thread the same bound actions.** The page keeps every `action.bind(...)` expression and passes each bound action to the section that renders it. Sections never import `./actions` for their own binding; they receive ready-to-use actions, so the page remains the single place where a change is bound to a server action.
6. **Preserve the trigger contract.** `ADD_DAY_TRIGGER_ID` stays on the left-aside add-day button only, and `ADD_ITEM_LAST_DAY_TRIGGER_ID` stays on the last day's add-item button only; the mobile add-day button keeps no id, exactly as today. `TripEditorShortcuts` and `UndoToastHost` stay in the page.
7. **Enforce the budget.** Measure every resulting file; `page.tsx` and each section file must be under ~300 lines. If the center or right rail still exceeds the budget, split further along the same seam (`DayCard` vs `ItinerarySection`; actions/finance/completeness vs media/checklist/history/feedback/packing) rather than accepting a partial result.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/dashboard/trips/[id]/page.tsx` | Modified | Becomes the composer: data loading, derived aggregates, env flags, action bindings, section composition, `TripEditorShortcuts` + `UndoToastHost`. Under ~300 lines. |
| `src/app/dashboard/trips/[id]/sections/trip-editor-meta.ts` | New | `statusMeta` map and `countDaysInRange`, moved verbatim from the page. |
| `src/app/dashboard/trips/[id]/sections/TripHeaderSection.tsx` | New | Header/publish block and published-lock banner. |
| `src/app/dashboard/trips/[id]/sections/DaysNavSection.tsx` | New | Left aside: day anchors, add-day dialog (`ADD_DAY_TRIGGER_ID`), generate-days button. |
| `src/app/dashboard/trips/[id]/sections/ItinerarySection.tsx` | New | Center column shell, itinerary header card, day list loop, mobile add-day row. |
| `src/app/dashboard/trips/[id]/sections/DayCard.tsx` | New | Single day card with item rows and the add-item dialog (`ADD_ITEM_LAST_DAY_TRIGGER_ID` on the last day). |
| `src/app/dashboard/trips/[id]/sections/TripSidebarActionsSection.tsx` | New | Acciones (incl. published-lock copy), Finanzas, Completitud. |
| `src/app/dashboard/trips/[id]/sections/TripSidebarDetailsSection.tsx` | New | Cover, photos, documents, `ServiceChecklistManager`, status history, feedback, packing, danger zone. |
| `src/app/dashboard/trips/[id]/__tests__/page.test.ts` | Modified | Reads the page plus the section files; same seven assertions, updated locations. |
| `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` | Verified | No edit expected; it does not touch page JSX. |
| `src/app/dashboard/trips/[id]/actions.ts` | Verified | No edit: no action signature or binding changes. |
| `architecture.md` | Modified/Verified | Technical source of truth: the folder listing enumerates `trips/[id]/` and nested route folders; add `trips/[id]/sections/` if that listing ages. |
| `README.md` | Verified | Truth-source table: "Técnica (cómo está hecho)" points to `architecture.md`; confirm no README edit is required. |

## Size Exception (documented, per `architecture.md`)

`architecture.md:427-428` requires that a single extraction above ~400 changed lines either documents the exception or is split. This change is a **mechanical move** of ~660 JSX lines out of `page.tsx` and into ~6 new files, so the git diff will report roughly 1,300–1,400 changed lines (deletions in `page.tsx` + insertions in the new files + the test update), with almost no new logic. The exception is documented here and in `design.md` (D8):

- **Chained PRs were considered and rejected.** Any partial slice (e.g. extract only the header) leaves the pin test and the page's DOM order half-migrated, and the diff of a pure move is only reviewable as a whole: reviewing "did anything change?" requires seeing the deleted block and the new module side by side. Chaining would multiply the reviewer's context switches without shrinking the real review surface.
- **Mitigation for the large diff:** the change is one PR with work-unit commits (pin update → meta module → header → days nav → center → sidebars → verification), so each commit is a bounded, individually reviewable move.
- **Reviewer guidance:** the review should be a byte-level comparison of moved blocks (same class strings, same text, same `key`/`id`, same bind expressions) plus the size measurement, not a line-by-line audit of unchanged markup.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| A moved JSX block silently changes a class string, copy, or DOM order | Medium | Requirements and tasks forbid any assertion, markup, or copy change; the structural pin test asserts the corporate class strings; the local e2e suite is the behavioral net. Diff review compares moved blocks against deleted blocks. |
| A section accidentally gains `"use client"`, breaking Server Component composition or serializing bound actions | Low | All sections are Server Components; no new client component is allowed; `npx tsc --noEmit` and the build catch directive/prop violations. |
| `ADD_DAY_TRIGGER_ID` / `ADD_ITEM_LAST_DAY_TRIGGER_ID` move to the wrong element or get duplicated, breaking keyboard shortcuts | Medium | Keep the ids on exactly the same two buttons (left-aside add-day, last-day add-item); the mobile add-day button keeps no id; `TripEditorShortcuts` stays in the page. |
| Derived values (totalCost, hasAnyCost, budgetDiff, completeness, dayOrder) are recomputed inside sections and drift | Medium | Cross-section computations stay in the page and are passed as props; only per-day `itemOrder` may be derived locally inside `DayCard`. |
| The structural pin test is "fixed" by weakening or dropping assertions | Medium | The assertion set is frozen: same seven `expect(...toContain(...))` calls, only the read set changes. No assertion may be deleted or narrowed. |
| `page.tsx` stays above ~300 lines because of the ~48 action bindings + composer JSX | Medium | Budget is measured with `wc -l` in verification; if it is over, extract further along the planned sub-seams (a grouped `actions` prop object per section is the fallback) rather than accept a partial split. |
| `architecture.md` folder listing ages and is left stale | Low | The doc-freshness task explicitly checks the `trips/[id]/` entry and nested route listing; the README truth-source table is verified in the same PR. |
| A dialog prop or bind expression is transcribed wrong during the move | Medium | Keep every `action.bind(...)` expression verbatim in the page and pass the bound value through; `npx tsc --noEmit` verifies the prop shapes, and the local e2e suite exercises publish, day/item CRUD, documents and checklist flows. |

## Rollback Plan

- Revert the commits of this change. `page.tsx` returns to its pre-refactor version, the `sections/` folder is deleted, and `page.test.ts` returns to reading only `page.tsx`. No other file is touched, so no test outside this change needs a revert.
- No migrations, no schema changes, no `src/lib/data*` changes, no Server Action changes, no dependency changes, no new environment variables: the rollback is a low-risk revert.

## Dependencies

- Existing Vitest unit runner (`npm run test`) and the Playwright local project (`npm run test:e2e -- --project=local`) plus the local Supabase stack, already used by the repo.
- The `README.md` truth-source table row for technical topics, which points to `architecture.md`.
- No new packages.

## Success Criteria

- [ ] `src/app/dashboard/trips/[id]/__tests__/page.test.ts` reads `page.tsx` plus the new section files and runs the **same** assertion set; it fails before the section files exist (RED) and passes after extraction (GREEN).
- [ ] `page.tsx` is a composer: data loading, derived aggregates, env flags, action bindings, section composition, shortcuts and undo host.
- [ ] Every extracted section is a Server Component (no `"use client"`) rendering the same markup, copy, order, `key`s, `id`s and bind expressions as today.
- [ ] `statusMeta` and `countDaysInRange` live in `sections/trip-editor-meta.ts` and are imported where used.
- [ ] `ADD_DAY_TRIGGER_ID` and `ADD_ITEM_LAST_DAY_TRIGGER_ID` remain on exactly the same two buttons.
- [ ] `page.tsx` and every new section file are under ~300 lines.
- [ ] No behavior, design, copy, or assertion changes; `actions.ts` and the client dialogs' public props are untouched.
- [ ] The >400-lines exception is documented in this proposal and `design.md`, with the single-PR decision and its rationale.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run build`, `npm run test`, and `npm run test:e2e -- --project=local` (Supabase stack up) pass.
- [ ] `architecture.md` is updated if the `trips/[id]/` listing aged, and the `README.md` truth-source table is verified.

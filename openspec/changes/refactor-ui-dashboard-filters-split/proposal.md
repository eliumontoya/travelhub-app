# Proposal: Split `DashboardFilters.tsx` into a URL library, a generic combobox, and a badges component

**Change slug:** `refactor-ui-dashboard-filters-split`
**Issue:** [#373 — Reducir los componentes sobredimensionados del editor de viaje y dashboard](https://github.com/eliumontoya/travelhub-app/issues/373) (PR 4 of 4)
**Phase:** propose
**Status:** ready for spec + design

## Intent

`src/app/dashboard/DashboardFilters.tsx` is 480 lines and is the last of the four oversized files called out by issue #373. A single `"use client"` component currently plays four unrelated roles at once:

1. **URL round-trip logic** — `deserializeFilters(searchParams)` (`:456-480`) parses the query string into `Partial<TripFilters>`; `syncUrl(f)` (`:54-69`) rebuilds the query string with `router.replace(..., { scroll: false })` after deleting the frozen key list `["q","status","dateFrom","dateTo","client","tags","agent","currency","page","clientsPage"]` (`:56`); `clean(f)` (`:71-82`) drops empty values. These are the only pure, non-React pieces of the file, and they duplicate the filters domain that already lives in `src/lib/trip-filters.ts`.
2. **Three near-identical comboboxes** — client single-select (`:266-310`), tags multi (`:311-348`) and agent multi (`:349-388`) repeat the same idiom: `normalize` (`:7-9`), `slice(0, 8)`, a 150 ms blur timeout, a `mousedown`-preventDefault option button, and per-instance `query`/`open` state (`:195-228`). Only the **client** combobox carries an extra quirk: on blur, if the field is empty and nothing was just picked, it clears the client filter (`:276-283`, guarded by the `clientJustSelected` ref at `:45`).
3. **Active-filter badges** — `activeBadges` (`:114-193`) derives one removable badge per active filter and renders it next to the `"Limpiar filtros"` button (`:424-452`). The memo closes over the render-scoped `updateFilters`, which is why it carries the `// eslint-disable-next-line react-hooks/exhaustive-deps` at `:192`.
4. **The remaining controls** — text search (`:234-242`, debounced 300 ms), status checkboxes (`:243-265`), date range (`:389-406`) and currency select (`:407-423`, immediate).

The size and the mix make the file hard to review: a URL-key change, a combobox tweak and a badge copy change all touch the same 480-line surface. The goal is a **pure refactor** — zero behavior and zero design change — that puts the URL layer in the existing filters domain module, replaces the three combobox copies with one generic client component, extracts the badges block, and leaves `DashboardFilters.tsx` as a shell under ~300 lines. One PR.

### Evidence

Line references are from the current worktree's `src/app/dashboard/DashboardFilters.tsx` (480 lines, single `"use client"` at `:1`, `data-testid="trip-filters"` at `:231`).

- **State:** `filters` initialised from `deserializeFilters(searchParams)` (`:41-43`), `debounceRef` (`:44`), `clientJustSelected` ref (`:45`), unmount cleanup for the debounce (`:47-52`), and the three combobox-local `query`/`open` pairs plus their result memos (`:195-228`).
- **Logic:** `syncUrl` (`:54-69`) is the only writer (`router.replace(\`?${params.toString()}\`, { scroll: false })` at `:68`); `clean` (`:71-82`); `applyFilters(next, immediateSync)` (`:84-103`) chooses the 300 ms debounce path or the immediate path and always calls the `onChange` prop; `updateFilters(update, immediateSync)` (`:105-107`); `clearAll()` (`:109-111`); `activeBadges` memo (`:114-193`, `eslint-disable` at `:192`); module-level `deserializeFilters` (`:456-480`).
- **Debounce semantics are per-control:** the text input calls `updateFilters(..., false)` (debounced); status, date, currency and every combobox/badge action call `updateFilters(..., true)` (immediate). The immediate path clears any pending timeout before syncing (`:86-91`).
- **`normalize` is duplicated:** the local `normalize` (`:7-9`) is byte-identical in semantics to the canonical `normalizeFilterText` in `src/lib/trip-filters.ts:12-17` (`toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")`). The canonical function already serves `src/app/dashboard/clients/ClientsExplorer.tsx:7,22,26` and `trip-filters.ts:52,61`.
- **Call site:** exactly one — `src/app/dashboard/trips/TripsExplorer.tsx:91-97` renders `<DashboardFilters key={JSON.stringify(initialFilters)} onChange={() => undefined} clients={clients} tags={tags} travelAgents={travelAgents} />`. The `key` forces a **full remount** whenever the URL-derived `initialFilters` object changes, which is how the controlled inputs resync without a `useEffect`. `onChange` is a no-op: the **URL is the source of truth**, parsed server-side by `src/app/dashboard/trips/page.tsx` (`parseTripsSearchParams` at `:72-100`, consumed at `:20`) and fed back as `initialFilters`.
- **`travelAgents` gating:** the agent combobox renders only when `travelAgents && travelAgents.length > 0` (`:349-352`), and its result memo also bails when `!travelAgents` (`:223`).
- **Tests today:**
  - **No dedicated `DashboardFilters` component test.** `src/app/dashboard/__tests__/` only holds `layout.test.tsx` and `status-actions.test.ts`.
  - **Nearest component net:** `src/app/dashboard/trips/__tests__/TripsExplorer.test.tsx` renders `TripsExplorer` (which renders `DashboardFilters`) via `renderToStaticMarkup` with `next/navigation` mocked, and asserts the produced HTML contains `placeholder="Buscar por cliente o título de viaje…"` — i.e. it covers the shell's text input markup.
  - **Unit net:** `src/lib/__tests__/trip-filters.test.ts` covers `hasActiveTripFilters` and `tripMatchesFilters` (server-side matching), not URL parsing.
  - **E2E net:** `e2e/local/dashboard.spec.ts` asserts `/dashboard` has no `"Limpiar filtros"` button and no `"Borrador"` label (`:35-36`), `/dashboard/trips` shows the search placeholder and the `"Borrador"` checkbox (`:48-49`), and that URL prefill + typing round-trips through the URL while dropping `page`/`clientsPage` (`:70-87`). It does **not** assert combobox option lists, badge removal, or the client clear-on-blur quirk.
- **No structural pin** exists for `DashboardFilters` (nothing reads the file as text).

## Scope

### In Scope

- Extend the existing filters domain module `src/lib/trip-filters.ts` with the pure URL layer: `deserializeTripFilters`, `cleanTripFilters`, `buildTripFilterSearchParams`, plus the vocabularies the parser needs (`TRIP_FILTER_STATUSES`, `TRIP_FILTER_CURRENCIES`) and the frozen key tuple (`TRIP_FILTER_URL_KEYS`). Bodies move verbatim from `DashboardFilters.tsx:54-82` and `:456-480`.
- Add `src/lib/__tests__/trip-filter-url.test.ts`, a RED-first pin of the current URL parsing, cleaning and rebuilding behavior plus the canonical `normalizeFilterText` accent-folding contract. It is written and observed failing before the exports exist.
- Extract a generic `src/app/dashboard/filters/FilterCombobox.tsx` (`"use client"`) that reproduces the shared combobox idiom and owns the per-instance `query`/`open`/`justSelected` state; the three call sites (client single-select, tags multi, agent multi) replace their copies.
- Extract `src/app/dashboard/filters/FilterBadges.tsx` (`"use client"`) owning the `activeBadges` memo (with its `eslint-disable` unchanged) and the badges + `"Limpiar filtros"` markup.
- Keep `src/app/dashboard/DashboardFilters.tsx` at its path and export name; it becomes the shell: `filters` state, debounce ref, unmount cleanup, `syncUrl` (side effect only), `applyFilters`, `updateFilters`, `clearAll`, the text input, the status checkboxes, the date range, the currency select, and the three `<FilterCombobox>` plus `<FilterBadges>` compositions.
- De-duplicate the local `normalize` in favour of the canonical `normalizeFilterText` **only if** the pin proves equivalent semantics; otherwise keep the local copy and record the divergence.
- Update `architecture.md` if the dashboard folder listing ages by introducing `dashboard/filters/`, and verify the `README.md` truth-source table.
- Document the >400 changed-lines size exception required by `architecture.md:427-428`.

### Out of Scope

- Any behavior, design, copy, class-string, DOM-order, `data-testid`, `aria-label`, validation, or assertion change. The refactor is observably neutral.
- Any change to the debounce timing (300 ms), the blur timeout (150 ms), the `slice(0, 8)` result cap, the `immediateSync` flags per control, or the frozen URL key list (including `page` and `clientsPage`).
- Any change to the **client-only** clear-on-empty-blur quirk, to the excluded-selected rule of the tags/agent multi comboboxes, or to the agent combobox's `travelAgents?.length` gate.
- Introducing a custom hook. The orchestrator's design keeps state in the shell; `useServiceChecklist` from PR 3 remains the repo's only hook.
- Any change to `src/app/dashboard/trips/TripsExplorer.tsx`, its `key={JSON.stringify(initialFilters)}` remount contract, or `src/app/dashboard/trips/page.tsx` parsing.
- Dependency changes, new global state, moving data access, or touching `src/lib/data*` / Server Actions.
- The other three issue #373 files (`ItemFormDialog.tsx` — PR #410; `trips/[id]/page.tsx` — PR #411; `ServiceChecklistManager.tsx` — PR 3), each of which has its own change.
- Adding a new component-test harness (no `@testing-library/react` is added); the absence of combobox/badge component tests is stated as a known coverage limitation, not silently papered over.

## Capabilities

> This section is the CONTRACT between proposal and specs.

### New Capabilities

- `dashboard-filters-modularity`: the dashboard trip-filter surface keeps its observable URL round-trip, combobox, badge and debounce behavior unchanged while the URL layer moves into the filters domain module, the three combobox copies collapse into one generic client component that owns its own transient state, the badges block becomes a presentational client component, the shell keeps `filters` state and the debounce, and no file in the surface exceeds the ~300-line budget. Covers `src/lib/trip-filters.ts`, `src/lib/__tests__/trip-filter-url.test.ts`, `src/app/dashboard/filters/FilterCombobox.tsx`, `src/app/dashboard/filters/FilterBadges.tsx`, `src/app/dashboard/DashboardFilters.tsx`, and the `dashboard/` entry in `architecture.md`.

### Modified Capabilities

- None. This change is a pure refactor. `dashboard-workspace` (which owns the observable "Trip explorer" URL-filter contract in `openspec/specs/dashboard-workspace/spec.md`) MUST remain observably identical; only the internal module boundaries inside `DashboardFilters.tsx` change.

## Approach

1. **Pin the URL layer before moving it (TDD).** Write `src/lib/__tests__/trip-filter-url.test.ts` encoding the exact current URL behavior of `deserializeFilters` (`:456-480`), `clean` (`:71-82`) and the `syncUrl` core (`:56-66`), importing the not-yet-existing exports from `@/lib/trip-filters`. Run `npm run test -- trip-filter-url` and record RED (exports missing). Then move the bodies verbatim for GREEN.
2. **Follow the domain-module precedent.** The URL layer belongs with `hasActiveTripFilters` / `tripMatchesFilters` / `normalizeFilterText` in `src/lib/trip-filters.ts`, not in a client component. `trip-filters.ts` is already the filters domain and already owns the canonical `normalize`.
3. **Keep the side effect in the shell.** `buildTripFilterSearchParams` is pure (takes the current params, returns the next params); the shell's `syncUrl` keeps `router.replace(..., { scroll: false })`, reading `searchParams` from `useSearchParams`.
4. **One generic combobox, not three copies.** `FilterCombobox` owns `query`, `open` and the `justSelected` ref locally, reproduces `normalizeFilterText` + `slice(0, 8)` + the 150 ms blur timeout, excludes already-selected ids for `mode="multi"`, and exposes the client-only quirk through a `clearOnEmptyBlur` prop that only the client instance passes.
5. **Extract the badges with their lint exception.** `FilterBadges` receives `filters`, `clients`, `tags`, `travelAgents`, `statusLabels`, `onUpdate` and `onClearAll`; the memo keeps its exact dep array and its `// eslint-disable-next-line react-hooks/exhaustive-deps` comment, and returns `null` when there are no badges (replacing the shell's `{activeBadges.length > 0 && ...}` guard with identical DOM output).
6. **De-duplicate `normalize` only on proof.** Compare the local chain (`:7-9`) with `normalizeFilterText`; a pin case asserts the canonical output for accented input. If any case diverges, the local copy stays and the divergence is recorded instead of force-fit.
7. **No hook.** State stays in the shell; only the combobox's own transient UI state moves into `FilterCombobox`, which the shell never reads (verified: `clientQuery`, `tagQuery`, `agentQuery`, `clientOpen`, `tagOpen`, `agentOpen` are used only inside their own JSX blocks).
8. **Preserve the remount contract.** `TripsExplorer` keeps `key={JSON.stringify(initialFilters)}`; the shell must keep initialising `filters` from the URL so the remounted instance resyncs, and must never introduce a `useEffect`-based resync.
9. **Enforce the budget.** Measure every resulting file with `wc -l`; if the shell exceeds ~300 lines, extract the status/date/currency control group into a conditional `src/app/dashboard/filters/FilterControls.tsx` rather than accept a partial split.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/trip-filters.ts` | Modified | Adds `TRIP_FILTER_STATUSES`, `TRIP_FILTER_CURRENCIES`, `TRIP_FILTER_URL_KEYS`, `deserializeTripFilters`, `cleanTripFilters`, `buildTripFilterSearchParams`. Verbatim move of the pure bodies from `DashboardFilters.tsx`; reuses the existing `normalizeFilterText`. |
| `src/lib/__tests__/trip-filter-url.test.ts` | New | RED-first pin: parse all keys, defaults, empty handling, invalid status/currency, CSV splitting, key-list deletion (`page`/`clientsPage`), unrelated-param preservation, `clean` drops, and the canonical `normalizeFilterText` accent contract. |
| `src/app/dashboard/filters/FilterCombobox.tsx` | New | `"use client"` generic single/multi filter combobox: internal `query`/`open`/`justSelected`, canonical `normalizeFilterText`, `slice(0, 8)`, 150 ms blur timeout, `clearOnEmptyBlur` prop for the client-only quirk. |
| `src/app/dashboard/filters/FilterBadges.tsx` | New | `"use client"` presentational badges + `"Limpiar filtros"`; owns the `activeBadges` memo with its unchanged `eslint-disable` and dep array. |
| `src/app/dashboard/filters/FilterControls.tsx` | New (conditional, on measurement) | `"use client"` status/date/currency control group, created only if the shell would otherwise exceed ~300 lines. |
| `src/app/dashboard/DashboardFilters.tsx` | Modified | Becomes the shell: `filters` state, debounce, cleanup, `syncUrl`/`applyFilters`/`updateFilters`/`clearAll`, text input, status/date/currency controls, three `<FilterCombobox>` and `<FilterBadges>`. Keeps path, export name and `data-testid="trip-filters"`. Under ~300 lines. |
| `src/app/dashboard/trips/TripsExplorer.tsx` | Verified | No edit: the single call site (`:91-97`) and its `key={JSON.stringify(initialFilters)}` / `onChange={() => undefined}` contract stay unchanged. |
| `src/app/dashboard/trips/page.tsx` | Verified | No edit: `parseTripsSearchParams` (`:72-100`) remains the server-side URL source of truth. |
| `src/lib/__tests__/trip-filters.test.ts` | Verified | No edit: the server-side matching pins stay green. |
| `src/app/dashboard/trips/__tests__/TripsExplorer.test.tsx` | Verified | No edit: still renders `DashboardFilters` and asserts the search placeholder. |
| `e2e/local/dashboard.spec.ts` | Verified | No edit: the behavioral net for URL round-trip, `/dashboard` filter absence, and the status checkbox. |
| `architecture.md` | Modified/Verified | Technical source of truth: add `dashboard/filters/` to the folder listing if it enumerates nested dashboard folders, and/or list `trip-filters.ts` if the lib listing ages; otherwise leave untouched and record the decision. |
| `README.md` | Verified | Truth-source table: "Tecnica (como esta hecho)" points to `architecture.md`; confirm no README edit is required. |

## Size Exception (documented, per `architecture.md:427-428`)

`architecture.md` requires that an extraction above ~400 changed lines either documents the exception or is split. This change is a **mechanical move** of roughly 300 lines out of a 480-line component into a library module (~60 net new lines, most of it moved) and three co-located files, plus a ~120-line pin test; the git diff will report roughly 700–1,000 changed lines with almost no new logic. The exception is documented here and in `design.md` (D10):

- **Chained PRs were considered and rejected.** The URL move, the combobox collapse and the badge extraction are not independently shippable slices: a partial slice leaves the shell over budget and half-migrated, and the reviewer would re-read the same mechanical move in more contexts. A pure move is reviewable side-by-side, which one diff provides.
- **Mitigation for the large diff:** one PR with work-unit commits (URL pin RED → lib move GREEN → combobox extraction → badges extraction → shell trim → docs → verification), so each commit is a bounded, individually reviewable move.
- **Reviewer guidance:** read the diff as a byte-level comparison of moved blocks (same copy, same class strings, same conditional branches, same timeout values, same key order) plus the `wc -l` measurement, not as a line-by-line audit of unchanged markup.

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| The frozen URL key list drifts (a key is dropped, or `page`/`clientsPage` stops being deleted) so pagination stops resetting on filter change | Medium | The RED pin asserts the exact `TRIP_FILTER_URL_KEYS` tuple and the deletion of `page`/`clientsPage`; the e2e spec already asserts the URL loses `page`/`clientsPage` after typing (`:84-86`). |
| The debounce/immediate split is inverted while moving `applyFilters` | Medium | `applyFilters` stays in the shell with the same `immediateSync` boolean; each control keeps its exact flag (text `false`; status/date/currency/combobox/badge `true`); review checks each call site. |
| The client-only clear-on-blur quirk leaks to the tags/agent comboboxes (or is dropped entirely) | Medium | The quirk moves behind an explicit `clearOnEmptyBlur` prop passed only by the client instance; the condition `!justSelected && !query.trim() && selectedIds.length` is pinned in review and covered by the lib/e2e nets as far as they reach. |
| Combobox result ordering or the excluded-selected rule drifts in the generic component | Medium | The pin states the rule: single mode does not exclude; multi mode excludes selected ids, then matches normalized names, then `slice(0, 8)`. Review compares the generic body against the three deleted copies. |
| The `activeBadges` memo loses its `eslint-disable` or changes its dep array, silently changing when badges recompute | Medium | The extracted memo keeps the `// eslint-disable-next-line react-hooks/exhaustive-deps` and the exact `[filters, clients, tags, travelAgents]` dep array; `statusLabels` arrives as a stable prop. |
| `normalize` de-duplication changes accent folding for one of the comboboxes | Low | The canonical and local chains are byte-identical; the pin asserts the canonical output, and the fallback is to keep the local copy and record the divergence. |
| The remount contract breaks (an `useEffect` resync replaces the `key`) so the controlled inputs stop following the URL | Medium | Requirements forbid a new effect and require `filters` to be initialised from the URL; `TripsExplorer.tsx` is untouched and its `key={JSON.stringify(initialFilters)}` stays. |
| `DashboardFilters.tsx` stays above ~300 lines because the extraction is partial | Medium | The conditional `FilterControls` extraction is the planned headroom; measure with `wc -l` and split further rather than accept a partial result. |
| No component test covers combobox behavior, badges, or debounce timing, so a subtle drift ships unobserved | High | Stated explicitly as a coverage limitation; the mitigations are the URL-layer RED pin, the byte-level diff review of moved blocks, and the e2e URL/round-trip net. Adding a component harness is out of scope for a pure move. |
| `"use client"` placement drifts on a new module | Low | Every new `.tsx` carries `"use client"` (it is imported by the client shell and needs interactivity); `npx tsc --noEmit`, lint and the build catch violations. |

## Rollback Plan

- Revert the commits of this change. `DashboardFilters.tsx` returns to its pre-refactor version, the `src/app/dashboard/filters/` folder and the new pin test are deleted, and `src/lib/trip-filters.ts` loses the added URL exports. No other file is touched (the call site, `page.tsx`, the existing unit test, `TripsExplorer.test.tsx` and the e2e spec were never modified), so no test outside this change needs a revert.
- No migrations, no schema changes, no `src/lib/data*` changes, no Server Action changes, no dependency changes, no new environment variables: the rollback is a low-risk revert.

## Dependencies

- Existing Vitest unit runner (`npm run test`) and the Playwright local project (`npm run test:e2e -- --project=local`) plus the local Supabase stack, already used by the repo.
- The `README.md` truth-source table row for technical topics, which points to `architecture.md`.
- No new packages. The URL pin uses plain Vitest; no `@testing-library/react` is added.

## Success Criteria

- [ ] `src/lib/__tests__/trip-filter-url.test.ts` pins the URL parsing, cleaning and rebuilding behavior and fails before the exports exist (RED) and passes after the verbatim move (GREEN).
- [ ] `deserializeTripFilters`, `cleanTripFilters` and `buildTripFilterSearchParams` live in `src/lib/trip-filters.ts`, with the exact key list including `page` and `clientsPage`.
- [ ] The local `normalize` is removed in favour of the canonical `normalizeFilterText` only on proven equivalence; the decision is recorded (and the local copy kept otherwise).
- [ ] `src/app/dashboard/filters/FilterCombobox.tsx` renders all three comboboxes (client single, tags multi, agent multi) with identical copy, classes, `slice(0,8)` and 150 ms blur behavior; `query`/`open`/`justSelected` live inside it.
- [ ] `clearOnEmptyBlur` is `true` only for the client combobox; the tags/agent instances never clear on blur.
- [ ] `src/app/dashboard/filters/FilterBadges.tsx` owns the badge memo with its unchanged `eslint-disable` and dep array, and renders the `"Limpiar filtros"` button.
- [ ] `DashboardFilters.tsx` keeps its path, export name and `data-testid="trip-filters"`, and every resulting file is under ~300 lines.
- [ ] `TripsExplorer.tsx` (`:91-97`, `key={JSON.stringify(initialFilters)}`), `trips/page.tsx`, `trip-filters.test.ts`, `TripsExplorer.test.tsx` and `e2e/local/dashboard.spec.ts` are unmodified.
- [ ] No behavior, design, copy, class-string, `immediateSync` flag, timeout or key-order change.
- [ ] The >400-lines exception is documented in this proposal and `design.md`, with the single-PR rationale and reviewer guidance.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, and `npm run test:e2e -- --project=local` (Supabase stack up) pass.
- [ ] `architecture.md` is updated if its dashboard/lib listing aged, and the `README.md` truth-source table is verified.

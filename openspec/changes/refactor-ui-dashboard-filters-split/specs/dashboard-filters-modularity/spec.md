# Dashboard Filters Modularity Specification

## Purpose

Keep the dashboard trip-filter surface observably identical while reducing `src/app/dashboard/DashboardFilters.tsx` (480 lines) to a shell under ~300 lines. The URL round-trip layer moves into the filters domain module, the three duplicated comboboxes collapse into one generic component that owns its own transient UI state, and the active-filter badges become a presentational client component — while the shell keeps `filters` state, the debounce, and the remaining controls. This is a pure refactor: no behavior, design, copy, class-string, timeout, validation, or assertion change.

Baseline: `baseline-from-current-implementation` — every requirement below describes behavior that already exists today and MUST remain observable-equivalent after the split (issue #373, PR 4 of 4).

Scope: `src/lib/trip-filters.ts`, `src/lib/__tests__/trip-filter-url.test.ts`, `src/app/dashboard/filters/FilterCombobox.tsx`, `src/app/dashboard/filters/FilterBadges.tsx`, `src/app/dashboard/DashboardFilters.tsx`, and the technical documentation in `architecture.md`. `src/app/dashboard/trips/TripsExplorer.tsx`, `src/app/dashboard/trips/page.tsx`, `src/lib/__tests__/trip-filters.test.ts`, `src/app/dashboard/trips/__tests__/TripsExplorer.test.tsx` and `e2e/local/dashboard.spec.ts` are untouched.

## Requirements

### Requirement: URL filter round-trip fidelity

The URL layer MUST move into `src/lib/trip-filters.ts` and MUST preserve the current parsing and mutation semantics exactly. `deserializeTripFilters` MUST reproduce `deserializeFilters` byte-for-byte in behavior: `q`, `dateFrom` and `dateTo` are kept only when truthy; `status` is split on `,`, filtered to `draft|published|archived`, and omitted when nothing survives; `client`, `tags` and `agent` are split on `,` without trimming into `clientIds`, `tagIds` and `agentIds`; `currency` is kept only when it is `MXN|USD|EUR`. `cleanTripFilters` MUST drop empty values. `buildTripFilterSearchParams` MUST delete the frozen key list — including `page` and `clientsPage` — before setting the non-empty filters, and MUST preserve unrelated params.

#### Scenario: All keys parsed

- GIVEN a query string with `q`, `status`, `dateFrom`, `dateTo`, `client`, `tags`, `agent` and `currency`
- WHEN `deserializeTripFilters` runs
- THEN the result MUST contain `query`, `status`, `dateFrom`, `dateTo`, `clientIds`, `tagIds`, `agentIds` and `currency`
- AND the CSV filters MUST be split on `,` exactly as today.

#### Scenario: Defaults and empty handling

- GIVEN an empty query string, or one with blank `q`, blank dates, an all-invalid `status` or an invalid `currency`
- WHEN `deserializeTripFilters` runs
- THEN the result MUST be `{}` for the empty case
- AND blank, invalid or unsupported values MUST be omitted rather than stored as empty values.

#### Scenario: Frozen key list deleted on sync

- GIVEN the current params and a set of filters
- WHEN `buildTripFilterSearchParams` runs
- THEN `q`, `status`, `dateFrom`, `dateTo`, `client`, `tags`, `agent`, `currency`, `page` and `clientsPage` MUST all be deleted first
- AND `page` and `clientsPage` MUST NOT survive the sync, so changing a filter resets pagination.

#### Scenario: Unrelated params preserved

- GIVEN a param outside the filter key list (for example `foo=bar`)
- WHEN `buildTripFilterSearchParams` runs
- THEN that param MUST remain in the returned params.

### Requirement: Debounce and immediate sync semantics unchanged

`applyFilters` MUST stay in the shell and MUST keep its `immediateSync` argument: the text search MUST pass `false` and therefore write the URL after a 300 ms debounce; status, dates, currency, every combobox selection and every badge removal MUST pass `true` and MUST write the URL immediately, clearing any pending debounce first. The unmount cleanup that clears the pending timeout MUST be preserved. The shell MUST NOT add a `useEffect` beyond that cleanup.

#### Scenario: Debounced text search

- GIVEN the pending debounce is armed from a previous keystroke
- WHEN the agent types in the text search
- THEN the URL MUST be updated only after 300 ms
- AND `onChange` MUST still be called with the cleaned filters on every keystroke.

#### Scenario: Immediate controls clear the pending debounce

- GIVEN a pending text debounce
- WHEN the agent toggles a status, changes a date, changes the currency, picks a combobox option or removes a badge
- THEN any pending timeout MUST be cleared and the URL MUST be updated immediately
- AND the `onChange` prop MUST still be called with the cleaned filters.

#### Scenario: Pending timeout cleared on unmount

- GIVEN a pending debounce
- WHEN the component unmounts — including the `key={JSON.stringify(initialFilters)}` remount
- THEN the timeout MUST be cleared.

### Requirement: Generic combobox behavior fidelity

The three comboboxes MUST be rendered by a single generic client component that reproduces the shared idiom exactly: an empty normalized query yields no results; `mode === "multi"` excludes already-selected ids while `mode === "single"` does not; candidates match on accent-insensitive, case-insensitive normalized names; results are capped at 8; the input opens the list on focus and on change; the blur handler closes the list after 150 ms; option buttons prevent default on `mousedown` so the click is not lost to blur. The transient `query`/`open`/`justSelected` state MUST live inside the combobox and MUST NOT be exposed to the shell.

#### Scenario: Result rule preserved

- GIVEN a combobox with candidates and empty or non-empty search text
- WHEN the agent types
- THEN an empty normalized query MUST produce no options, `mode="multi"` MUST exclude ids present in `selectedIds`, matches MUST use accent-insensitive normalized names, and at most 8 options MUST render.

#### Scenario: Copy, markup and classes identical

- GIVEN the three deleted combobox blocks
- WHEN they are compared with the generic component and its three call sites
- THEN the placeholders (`Filtrar por cliente…`, `Filtrar por tags…`, `Filtrar por agente…`), the input/ul/li/button class strings, `autoComplete="off"`, the `onMouseDown` preventDefault and the option-label rendering MUST be unchanged.

#### Scenario: Transient state is not exposed

- GIVEN the shell and the combobox
- WHEN the components are inspected
- THEN `query`, `open` and the just-selected flag MUST exist only inside the combobox
- AND the shell MUST NOT read or pass them.

#### Scenario: Agent combobox stays gated

- GIVEN `travelAgents` is undefined or empty
- WHEN the shell renders
- THEN the agent combobox MUST NOT render
- AND with a non-empty `travelAgents` list it MUST render exactly as today.

### Requirement: Client-only clear-on-empty-blur quirk preserved

Only the client combobox MUST clear the client filter when the field is empty and the user leaves it without having just picked an option. The behavior MUST be opt-in through an explicit prop (`clearOnEmptyBlur`), passed only by the client instance; the tags and agent instances MUST NOT clear on blur. The just-selected guard MUST still be set when an option is picked and reset on blur.

#### Scenario: Empty blur clears the client filter

- GIVEN a selected client filter and an empty client search field, with no option just picked
- WHEN the client combobox loses focus
- THEN the client filter MUST be cleared immediately (`clientIds: undefined`, immediate sync).

#### Scenario: A just-picked option is not cleared

- GIVEN the agent just clicked a client option (which clears the query and closes the list)
- WHEN the resulting blur fires within the 150 ms window
- THEN the client filter MUST NOT be cleared
- AND the just-selected flag MUST be reset for the next interaction.

#### Scenario: Multi comboboxes never clear on blur

- GIVEN the tags or agent combobox with a selected filter and an empty search field
- WHEN it loses focus
- THEN no filter MUST be cleared.

### Requirement: Active filter badges parity

The badges MUST be extracted into a presentational client component that reproduces the current output and interactions byte-for-byte: the same badge set and order (query, each status, the combined date range, each client, each tag, each agent, currency), the same labels (quoted query, status label, `dateFrom – dateTo`, entity name falling back to its id, currency), the same badge keys, the same `aria-label` (`Quitar filtro ${label}`) and `×` button, and the same `"Limpiar filtros"` button. Removing a badge MUST call the update handler with the immediate flag. With no active filters the component MUST render nothing.

#### Scenario: Badges built in the same order

- GIVEN filters with a query, two statuses, a date range, a client, a tag and a currency
- WHEN the badges render
- THEN one badge per active value MUST appear in the current order
- AND each label MUST match today's text, including the ` – ` separator for the date range and the entity-name fallback to id.

#### Scenario: Badge removal and clear-all

- GIVEN rendered badges
- WHEN the agent clicks a badge's `×` or the `"Limpiar filtros"` button
- THEN the corresponding filter (or all filters) MUST be cleared with immediate URL sync
- AND the badges MUST update from the new filter state.

#### Scenario: No badges, no DOM

- GIVEN no active filters
- WHEN the shell renders
- THEN no badge container and no `"Limpiar filtros"` button MUST be produced
- AND this MUST match the current `{activeBadges.length > 0 && ...}` output exactly.

#### Scenario: Badge memo lint directive preserved

- GIVEN the `activeBadges` memo closes over render-scoped handlers
- WHEN the badge component is reviewed
- THEN it MUST keep the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment and the exact `[filters, clients, tags, travelAgents]` dependency array
- AND no dependency MUST be added or removed.

### Requirement: URL as the source of truth and the remount contract

The component MUST keep consuming the URL as the source of truth: its `filters` state MUST be initialised from the search params on mount, `onChange` MUST remain informational (the call site passes a no-op), and no effect or controlled-prop sync MUST be introduced. The single call site in `TripsExplorer.tsx` MUST keep its `key={JSON.stringify(initialFilters)}` remount, which is how the controlled inputs resync after a URL change.

#### Scenario: Initial state from the URL

- GIVEN `/dashboard/trips?q=Cancún&status=draft`
- WHEN the filters component mounts (including after a remount)
- THEN the text input MUST show `Cancún` and the `Borrador` checkbox MUST be checked
- AND this MUST come from the URL-derived initial state, not from an effect.

#### Scenario: Remount key preserved

- GIVEN `TripsExplorer.tsx` renders `<DashboardFilters key={JSON.stringify(initialFilters)} onChange={() => undefined} … />`
- WHEN the refactor lands
- THEN the call site MUST be unmodified
- AND no `useEffect` performing a state sync MUST be added to the filters component.

### Requirement: Modular boundaries with a file-size budget

`DashboardFilters.tsx` MUST keep its path, its named export and its `data-testid="trip-filters"`, and MUST become a shell that keeps `filters` state, the debounce, and the text/status/date/currency controls while composing the extracted pieces. No new custom hook MUST be introduced. Every file in the surface — the shell, the lib module, and each file under `src/app/dashboard/filters/` — MUST be under ~300 lines.

#### Scenario: Shell budget met

- GIVEN the final diff
- WHEN line counts are measured with `wc -l` for `DashboardFilters.tsx`, `src/lib/trip-filters.ts` and every file under `src/app/dashboard/filters/`
- THEN the shell MUST be under ~300 lines
- AND every other file MUST be under ~300 lines.

#### Scenario: No hook introduced

- GIVEN PR 3 introduced the repo's first custom hook, `useServiceChecklist`
- WHEN the refactor is reviewed
- THEN no new `use*.ts` module MUST be created for this surface
- AND the only state that leaves the shell MUST be the combobox's own transient `query`/`open`/`justSelected`.

#### Scenario: Client directive convention respected

- GIVEN the extracted components are imported by a client component and need interactivity
- WHEN their first lines are inspected
- THEN each extracted `.tsx` MUST carry `"use client"`, matching the `src/components/item-form/*` precedent
- AND the pure lib module MUST NOT carry a client directive.

### Requirement: Pure refactor with no observable change

The change MUST be limited to module boundaries and file placement. It MUST NOT alter copy, validation, class strings, DOM order, `data-testid`, `immediateSync` flags, the 300 ms debounce, the 150 ms blur timeout, the `slice(0, 8)` cap, the frozen URL key list, the agent gate, or the client-only blur quirk. The `normalize` chain MUST be de-duplicated to the canonical `normalizeFilterText` only when equivalence is proven; if any case diverges, the local copy MUST be kept and the divergence recorded.

#### Scenario: Call-site contract intact

- GIVEN `TripsExplorer.tsx` is the only consumer
- WHEN the refactor lands
- THEN it MUST NOT be edited
- AND the public props (`onChange`, `clients`, `tags`, `travelAgents?`) MUST be unchanged.

#### Scenario: Normalization equivalence proven or kept

- GIVEN the component's local `normalize` and the canonical `normalizeFilterText`
- WHEN they are compared and pinned
- THEN the canonical normalizer's accent-folding output MUST be asserted
- AND the local copy MUST be removed only if the semantics are proven equivalent; otherwise it MUST stay and the divergence MUST be recorded.

#### Scenario: Product behavior and assertions intact

- GIVEN the refactor diff
- WHEN the unit and local e2e suites run
- THEN no existing assertion about behavior, texts, states or URLs MUST have been removed or weakened
- AND the pre-existing `trip-filters.test.ts`, `TripsExplorer.test.tsx` and `dashboard.spec.ts` MUST pass without modification.

### Requirement: Honest TDD evidence and a documented coverage gap

The URL layer MUST be pinned first: a new `src/lib/__tests__/trip-filter-url.test.ts` MUST describe the current parsing, cleaning and rebuilding behavior and MUST be observed failing before the exports exist (RED), then passing after the verbatim move (GREEN). The change MUST NOT claim a RED it did not observe. The absence of a component test for combobox behavior, badge rendering and debounce timing MUST be stated explicitly rather than papered over.

#### Scenario: URL pin is the RED

- GIVEN `trip-filter-url.test.ts` imports the new exports from `@/lib/trip-filters`
- WHEN it runs before those exports exist
- THEN it MUST fail because the exports are unavailable
- AND after the verbatim move it MUST pass.

#### Scenario: Nets are not misreported as REDs

- GIVEN the refactor is transparent to the e2e spec and to the `TripsExplorer` markup test
- WHEN the TDD evidence is reported
- THEN those tests MUST be reported as nets, not as failing-first signals.

#### Scenario: Coverage gap recorded

- GIVEN the repo has no `@testing-library/react` and `renderToStaticMarkup` cannot exercise blur, typing or timers
- WHEN the verification handoff is written
- THEN the combobox/badge/debounce behavior MUST be recorded as covered only by byte-level diff review
- AND no unobserved automated coverage MUST be claimed.

### Requirement: Full verification battery

The refactor MUST pass the repository's full verification battery: typecheck, lint, unit tests, production build, and the local Playwright project with the Supabase stack up. The change MUST NOT be reported complete while any required command fails, unless the failure is a known pre-existing environmental failure named as such.

#### Scenario: Static and unit checks

- GIVEN the refactored shell, lib module, combobox and badges component
- WHEN `npx tsc --noEmit`, `npm run lint` and `npm run test` run
- THEN all three MUST pass
- AND the moved badge memo MUST NOT introduce a new exhaustive-deps lint error.

#### Scenario: Build and end-to-end checks

- GIVEN a clean production build and a running local Supabase stack
- WHEN `npm run build` and `npm run test:e2e -- --project=local` run
- THEN the build MUST be clean
- AND the local e2e suite MUST pass, exercising the dashboard URL round-trip.

#### Scenario: Verification reported per command

- GIVEN the verification phase is complete
- WHEN the change is handed off
- THEN each command MUST be reported with its exact command line and observed result
- AND any pre-existing failure not caused by this change MUST be named explicitly instead of being silently absorbed.

### Requirement: Documentation source of truth checked

The `README.md` truth-source table (`architecture.md` is the technical source of truth) MUST be verified. The `architecture.md` folder listing that records co-located dashboard folders MUST be updated when introducing `src/app/dashboard/filters/` ages that listing; if no listed entry aged, `architecture.md` MUST be left untouched and the decision recorded.

#### Scenario: Folder listing freshness

- GIVEN the `architecture.md` dashboard listing that already records `trips/[id]/sections/` and `trips/[id]/service-checklist/`
- WHEN the refactor lands
- THEN the listing MUST include `dashboard/filters/` if it enumerates co-located folders
- AND the decision about the `lib/` block (whether to list `trip-filters.ts`) MUST be recorded.

#### Scenario: Truth-source table verified

- GIVEN the `README.md` truth-source table row mapping technical topics to `architecture.md`
- WHEN the change is reviewed
- THEN that row MUST be verified as still accurate
- AND `README.md` MUST be left unchanged unless the row aged.

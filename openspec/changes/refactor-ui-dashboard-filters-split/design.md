# Design: Split `DashboardFilters.tsx` into a URL library, a generic combobox, and a badges component

## Technical Approach

Reduce `src/app/dashboard/DashboardFilters.tsx` (480 lines) to a shell under ~300 lines by moving each responsibility along the seam where it already exists:

1. **The URL layer leaves the client component.** `deserializeFilters` (`:456-480`), `clean` (`:71-82`) and the pure core of `syncUrl` (`:56-66`) move into `src/lib/trip-filters.ts`, the module that already owns `normalizeFilterText`, `hasActiveTripFilters` and `tripMatchesFilters`. The shell keeps only the `router.replace(..., { scroll: false })` side effect.
2. **The three comboboxes collapse into one generic component.** `FilterCombobox.tsx` reproduces the shared idiom (canonical `normalizeFilterText`, `slice(0, 8)`, a 150 ms blur timeout, a `mousedown`-preventDefault option button) and owns the per-instance `query`/`open`/`justSelected` state that the shell never reads. The client-only clear-on-blur quirk becomes an explicit `clearOnEmptyBlur` prop.
3. **The badges block becomes a presentational child.** `FilterBadges.tsx` owns the `activeBadges` memo — including its `eslint-disable` and its exact dep array — and the badges + `"Limpiar filtros"` markup.
4. **The shell keeps state and the remaining controls.** `filters` state (initialised from the URL), `debounceRef`, the unmount cleanup, `syncUrl`/`applyFilters`/`updateFilters`/`clearAll`, the text input, the status checkboxes, the date range and the currency select. **No custom hook is introduced** — PR 3's `useServiceChecklist` remains the repo's only hook.

The refactor is transparent to every existing test: the rendered HTML is identical. The only deterministic new artifact is the URL pin, which is written and observed failing before the lib exports exist. The design below is explicit about what is a real RED here versus what is only a net.

## Architecture Decisions

### Decision: the URL layer belongs in `src/lib/trip-filters.ts` (D1)

**Choice**: Add `deserializeTripFilters`, `cleanTripFilters`, `buildTripFilterSearchParams`, `TRIP_FILTER_URL_KEYS`, `TRIP_FILTER_STATUSES` and `TRIP_FILTER_CURRENCIES` to the existing `src/lib/trip-filters.ts`. Move the bodies verbatim from `DashboardFilters.tsx:56-66`, `:71-82` and `:456-480`.

**Alternatives considered**:
- *A new `src/app/dashboard/filters/filter-url.ts`* — rejected: the query-string contract is the filters domain, not dashboard presentation, and `trip-filters.ts` already parses/matches those exact filters and owns the canonical `normalizeFilterText`. Splitting URL parsing from matching would give the filters vocabulary two homes.
- *Keep `deserializeFilters` in the component and export it* — rejected: exporting domain parsing from a client component is the coupling this change removes, and it would leave the parser untestable without a React import.
- *A generic `src/lib/url-state.ts`* — rejected: there is no second consumer, and the function names are filter-specific (`TripFilters`, the frozen key list, status/currency vocabularies).

**Rationale**: `trip-filters.ts` is the module `src/app/dashboard/trips/page.tsx:4` and `src/lib/data/shared.ts:5` already import to answer "what do these filters mean". Adding "what does this URL mean" beside it gives the domain one source of truth.

### Decision: `syncUrl` keeps only the side effect in the shell (D2)

**Choice**: `buildTripFilterSearchParams(current: URLSearchParams, filters: Partial<TripFilters>): URLSearchParams` is pure and returns the next params (delete `TRIP_FILTER_URL_KEYS`, then set non-empty values in the original order). The shell's `syncUrl(f)` becomes `router.replace(\`?${buildTripFilterSearchParams(new URLSearchParams(searchParams.toString()), f).toString()}\`, { scroll: false })`.

**Alternatives considered**:
- *Return the final string from lib* — considered: marginally shorter at the call site, but it bakes the `?${...}` prefix into the domain module; returning `URLSearchParams` keeps the formatting decision in the component.
- *Pass `searchParams` (a `ReadonlyURLSearchParams`) straight into the helper* — rejected as the primary signature: the helper would then depend on a Next.js type. The shell narrows it with `new URLSearchParams(searchParams.toString())`, exactly as today.
- *Let the helper call `router.replace`* — rejected: it would put navigation into a lib module, violating the "no UI/navigation in the domain layer" convention.

**Rationale**: Keeping the side effect in the shell preserves the current control flow (`router.replace` with `{ scroll: false }`) while making the string transform unit-testable.

### Decision: `deserializeTripFilters` moves verbatim, quirks included (D3)

**Choice**: The parser is moved byte-for-byte, including its non-obvious behaviors: `q`/`dateFrom`/`dateTo` require a truthy value; `status` is split on `,` and filtered to `["draft","published","archived"]`, and the key is omitted when nothing survives; `client`/`tags`/`agent` are split on `,` **without trimming** (so `a,` yields `["a", ""]`); `currency` is kept only when it is `MXN | USD | EUR`.

**Alternatives considered**:
- *"Fix" the trailing-comma case while moving* — rejected: a pure refactor must not change behavior; the pin documents the current semantics instead. A cleanup is a separate change with its own test.
- *Share the parser with `trips/page.tsx:72-100`* — rejected: the page parses `searchParams` (a Next server record) with `firstParam`/`parseCsv`/`isDateParam` and additional rules (date-format regex, page clamping). Unifying the two parsers is a real behavior change and is explicitly out of scope.
- *Drop the vocabulary constants and inline the literals again* — rejected: `TRIP_FILTER_STATUSES`/`TRIP_FILTER_CURRENCIES` replace the current inline `["draft","published","archived"]` and `CURRENCY_OPTIONS` so the parser and the shell read one vocabulary.

**Rationale**: The pin is only honest if it encodes the code as it is, not as it "should" be. Moving the quirks verbatim keeps the change to module boundaries.

### Decision: one generic `FilterCombobox`, query/open state inside it (D4)

**Choice**: `src/app/dashboard/filters/FilterCombobox.tsx` (`"use client"`) receives `options` (`{ id, name }[]`), `selectedIds`, `mode: "single" | "multi"`, `placeholder`, `clearOnEmptyBlur?`, `onSelect(id)` and `onClear?`. It owns `query`, `open` and the `justSelected` ref, and derives its results locally: bail on an empty normalized query, exclude already-selected ids when `mode === "multi"`, match on `normalizeFilterText(name)`, then `slice(0, 8)`.

**Alternatives considered**:
- *Keep the result `useMemo`s in the shell and pass `results` as a prop* — rejected: it keeps the `query` state in the shell, so the shell still grows with three state pairs and three memos (the very lines `:195-228` this change removes).
- *Three props-variant wrappers (`ClientFilterCombobox`, `TagsFilterCombobox`, …)* — rejected: the markup is identical; three wrappers would duplicate the same body and multiply files.
- *Let the combobox compute the next `selectedIds` array* — rejected: the client replaces (`[id]`) while tags/agent append (`[...selected, id]`); keeping that choice in the shell's `onSelect` mirrors today's `onClick` bodies exactly.

**Rationale**: The shell never reads `clientQuery`/`tagQuery`/`agentQuery`/`clientOpen`/`tagOpen`/`agentOpen` — verified against `:195-228` and the three JSX blocks — so moving them into the component that renders them is behavior-neutral and removes ~34 lines of shell state.

### Decision: the client-only clear-on-blur quirk becomes an explicit prop (D5)

**Choice**: `FilterCombobox` reproduces the blur handler: `setTimeout(() => setOpen(false), 150)`; then `if (clearOnEmptyBlur && !justSelected.current && !query.trim() && selectedIds.length) onClear?.();` and always reset `justSelected.current = false`. Only the client instance passes `clearOnEmptyBlur` and an `onClear` that calls `updateFilters({ clientIds: undefined }, true)`.

**Alternatives considered**:
- *A `variant="client"` string prop with the quirk hardcoded inside* — rejected: it hides a behavior toggle behind a label and invites copy-paste of the condition into the multi modes.
- *Replicate the quirk in the shell around the component* — rejected: the shell cannot observe the combobox's internal blur/query state without re-adding the state this change removes.
- *Drop the quirk as a "bug fix"* — rejected: it is current, user-visible behavior (`:276-283`); removing it is out of scope and would break the client filter UX.

**Rationale**: The quirk is the one genuine behavioral difference between the three comboboxes; making it a named, opt-in prop keeps it visible in review and keeps the multi instances quirk-free.

### Decision: `FilterBadges` owns the memo and its lint exception; `statusLabels` is a prop (D6)

**Choice**: `src/app/dashboard/filters/FilterBadges.tsx` (`"use client"`) receives `filters`, `clients`, `tags`, `travelAgents`, `statusLabels`, `onUpdate`, `onClearAll`. It builds the same badges in the same order (query → each status → date range → each client → each tag → each agent → currency), calls `onUpdate(update)` where the shell binds `(update) => updateFilters(update, true)`, and keeps the memo's `// eslint-disable-next-line react-hooks/exhaustive-deps` and its exact `[filters, clients, tags, travelAgents]` dep array. It returns `null` when there are no badges, replacing the shell's `{activeBadges.length > 0 && ...}` with identical DOM output.

**Alternatives considered**:
- *Compute the badges in the shell and pass the array* — rejected: `onRemove` closures capture `updateFilters` and the lookup arrays; building them in the shell would put the memo and its closures back in the shell, defeating the extraction.
- *Add `statusLabels` to the memo dependencies and drop the disable* — rejected: changing the dep array is a behavior change (recompute timing) and the orchestrator's decision is to preserve the disable. `statusLabels` is a module-stable object passed once, so omitting it is safe and matches the existing pattern.
- *Move `STATUS_LABELS` into a co-located `filter-constants.ts`* — considered: it would decouple the badge component from the shell's constant, but adds a file and a second place where status copy lives. Passing the existing constant keeps one source; recorded as a future cleanup if more consumers appear.

**Rationale**: The badges block is a self-contained presentational concern whose only input is `filters` plus the lookup arrays and two callbacks. Moving the memo with its lint directive intact forecloses the most likely silent regression (a changed dep array).

### Decision: no custom hook; the shell keeps `filters` state (D7)

**Choice**: `DashboardFilters` keeps `useState(() => deserializeTripFilters(searchParams))`, `debounceRef`, the unmount cleanup effect and every handler. No `use*.ts` module is created; PR 3's `useServiceChecklist` stays the repo's only hook.

**Alternatives considered**:
- *A `useDashboardFilters` hook mirroring PR 3* — rejected: the shell is expected to land under ~300 lines without it (the extraction removes ~34 state lines, ~44 combobox JSX lines, ~30 badge lines and ~50 URL lines), and the orchestrator's design explicitly keeps state in the shell. Introducing a second hook convention for no budget need is churn.
- *Keep everything and extract only the combobox* — rejected: it leaves the shell at ~410 lines, missing the issue's goal.

**Rationale**: The smallest module-boundary change that reaches the budget is the right one; the hook remains available as a contingency if measurement disagrees.

### Decision: preserve the remount contract and forbid a resync effect (D8)

**Choice**: `TripsExplorer.tsx:91-97` keeps `key={JSON.stringify(initialFilters)}` and `onChange={() => undefined}`. The shell keeps initialising `filters` from the URL, so the remounted instance renders the URL state. No `useEffect` is added to `DashboardFilters`.

**Alternatives considered**:
- *Replace the remount key with a `useEffect` that syncs `filters` to `initialFilters`* — rejected: it inverts the current data flow, risks a render-with-stale-state flash, and would require editing the call site. The current design's JSDoc (`:19-27`) exists precisely to justify the key.
- *Make the shell fully controlled from `initialFilters`* — rejected: it changes the component's contract and props, beyond a pure move.

**Rationale**: The remount is load-bearing: it is how the controlled inputs follow the URL without an effect. The pin for it is structural (the call site is untouched) plus the e2e URL round-trip that re-navigates to `/dashboard/trips?q=Cancún&...` and asserts the input is prefilled.

### Decision: de-duplicate `normalize` only on proven equivalence (D9)

**Choice**: Remove the shell's local `normalize` (`:7-9`) and have `FilterCombobox` import `normalizeFilterText` from `@/lib/trip-filters`. This is authorized **only** because the two chains are byte-identical: `text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")`. The pin asserts the canonical function's output for accented input. If any case diverged, the local copy would stay and the divergence would be recorded.

**Alternatives considered**:
- *De-duplicate without a pin* — rejected: the pin is what makes "equivalent" an observed fact rather than an assumption.
- *Keep the local copy to minimize risk* — considered: acceptable fallback, but it leaves two implementations of the same filter normalization in the same feature; adopting the canonical one is the desired end state.

**Rationale**: `normalizeFilterText` already serves `ClientsExplorer.tsx:7,22,26` and `trip-filters.ts:52,61`; the dashboard filter was the last divergent copy.

### Decision: honest RED strategy — a URL pin, then nets (D10)

**Choice**: The new `src/lib/__tests__/trip-filter-url.test.ts` is the change's only true RED: it imports `deserializeTripFilters`, `cleanTripFilters`, `buildTripFilterSearchParams` and `TRIP_FILTER_URL_KEYS` from `@/lib/trip-filters` before those exports exist, so it fails on resolution, then passes after the verbatim move. `TripsExplorer.test.tsx` and `e2e/local/dashboard.spec.ts` are nets, not REDs.

**Alternatives considered**:
- *Treat the e2e spec as the RED* — rejected: the refactor is transparent to it (same rendered HTML, same URL behavior), so it cannot fail *because of* the split.
- *Add a component test for the combobox* — rejected as scope: the repo has no `@testing-library/react`; `renderToStaticMarkup` cannot exercise blur/typing/`setTimeout`, so such a test would either need new dependencies or assert only the initial markup (a weak pin). The absence is recorded as a coverage limitation.
- *A structural text pin reading `DashboardFilters.tsx`* — rejected: no such pin exists today, so adding one would be a fabricated RED.

**Rationale**: `strict_tdd: true` wants a real failing-first signal where one exists. The URL layer has one for free; the combobox/badge moves have no applicable deterministic test without a new harness, and that is stated instead of manufactured.

### Decision: single PR with a documented >400-line exception (D11)

**Choice**: Ship as one PR; document the size exception here and in `proposal.md` per `architecture.md:427-428`.

**Alternatives considered**:
- *Chained PRs (URL move, then combobox, then badges)* — rejected: no slice is independently green and under budget except the URL move, and the remaining two would still leave the shell over ~300 until the last one. A pure move is reviewable side-by-side in one diff.
- *Shrink the diff by reformatting while moving* — rejected: it hides the move and makes byte-level comparison harder.

**Rationale**: The change is large in diff lines and small in risk; the exception is documented rather than dodged, and work-unit commits bound each step.

### Decision: file-size budget ~300 lines (D12)

**Choice**: `DashboardFilters.tsx` and every new file under `src/app/dashboard/filters/` must be under ~300 lines, measured with `wc -l` in verification.

**Alternatives considered**:
- *No budget* — rejected: the issue's whole point is to cap file size.
- *Hard CI gate* — rejected: out of scope; a measurement task in the verification phase is enough.

**Rationale**: Expected sizes: `DashboardFilters.tsx` ~240–290, `FilterCombobox.tsx` ~90–120, `FilterBadges.tsx` ~80–110, `FilterControls.tsx` (conditional) ~60–90.

### Decision: documentation freshness checked, not assumed (D13)

**Choice**: Check the `architecture.md` folder listing. Its dashboard block enumerates nested folders (PR 2 added `trips/[id]/sections/`; PR 3 added `trips/[id]/service-checklist/`), so introducing `src/app/dashboard/filters/` ages that listing and SHOULD be recorded with a single new line. The `lib/` listing is non-exhaustive (`trip-filters.ts` is not listed today), so extending an existing lib module does not age it; adding `trip-filters.ts` is optional and recorded as a decision. The `README.md` truth-source table is verified in the same PR.

**Alternatives considered**:
- *Leave `architecture.md` untouched* — rejected: the dashboard listing demonstrably records co-located folders (two precedents in the same branch), so skipping it would make the doc stale.
- *Also list every new file* — rejected: the listing names folders and a few notable modules, not every file.

**Rationale**: Doc freshness is part of the PR checklist; the decision is recorded either way.

## Data Flow

### Before

```
src/app/dashboard/DashboardFilters.tsx  (480 lines, "use client", single owner)
   ├─ module: normalize (:7-9), STATUS_OPTIONS (:11), STATUS_LABELS (:12-16), CURRENCY_OPTIONS (:17)
   ├─ state: filters ← deserializeFilters(searchParams) (:41-43), debounceRef (:44),
   │         clientJustSelected (:45), cleanup effect (:47-52)
   ├─ logic: syncUrl (:54-69, key list :56, delete :57, router.replace :68),
   │         clean (:71-82), applyFilters (:84-103), updateFilters (:105-107), clearAll (:109-111)
   ├─ memo: activeBadges (:114-193, eslint-disable :192, deps :193)
   ├─ combobox state: client (:195-202), tags (:204-215), agent (:217-228)
   └─ JSX (:230-454):
        root data-testid="trip-filters" (:231)
        ├─ text search (:234-242, debounced)          ├─ status checkboxes (:243-265, immediate)
        ├─ client combobox (:266-310, clear-on-blur :276-283)
        ├─ tags combobox (:311-348)                   ├─ agent combobox (:349-388, gated)
        ├─ date range (:389-406)                      ├─ currency select (:407-423)
        └─ badges + "Limpiar filtros" (:424-452)
   └─ module: deserializeFilters (:456-480)
```

### After

```
src/lib/trip-filters.ts  (domain module, extended)
   ├─ normalizeFilterText (existing :12-17)
   ├─ TRIP_FILTER_STATUSES, TRIP_FILTER_CURRENCIES, TRIP_FILTER_URL_KEYS   (key list from :56)
   ├─ deserializeTripFilters(searchParams)      (moved from :456-480)
   ├─ cleanTripFilters(filters)                 (moved from :71-82)
   └─ buildTripFilterSearchParams(current, filters)  (pure core of :54-69)

src/app/dashboard/filters/FilterCombobox.tsx  ("use client", presentational + local UI state)
   ├─ props: options, selectedIds, mode, placeholder, clearOnEmptyBlur?, onSelect, onClear?
   ├─ internal: query, open, justSelected ref; results = normalizeFilterText + exclude(multi)
   │            + match + slice(0, 8)
   └─ markup: input (150 ms blur) + optional <ul> of <li><button onMouseDown preventDefault>

src/app/dashboard/filters/FilterBadges.tsx  ("use client", presentational)
   ├─ props: filters, clients, tags, travelAgents, statusLabels, onUpdate, onClearAll
   └─ activeBadges memo (unchanged eslint-disable + deps) + badges + "Limpiar filtros";
      returns null when empty

src/app/dashboard/DashboardFilters.tsx  (shell, < ~300 lines, "use client")
   ├─ state: filters ← deserializeTripFilters(searchParams), debounceRef, cleanup effect
   ├─ logic: syncUrl (build + router.replace), applyFilters, updateFilters, clearAll
   └─ JSX: data-testid="trip-filters"
        ├─ text search | status checkboxes | date range | currency select
        ├─ <FilterCombobox mode="single" clearOnEmptyBlur onSelect … onClear … />          (client)
        ├─ <FilterCombobox mode="multi" … onSelect={(id) => …[...selected, id]} />         (tags)
        ├─ {travelAgents?.length ? <FilterCombobox mode="multi" … /> : null}              (agent, gated)
        └─ <FilterBadges filters … statusLabels onUpdate={(u) => updateFilters(u, true)} onClearAll />
```

### URL round-trip (unchanged)

```
agent types in any control
   └─ updateFilters(update, immediateSync)
        ├─ text → false → setTimeout(300ms) → syncUrl(next)
        └─ others → true → clearTimeout + syncUrl(next)
              └─ buildTripFilterSearchParams(current, next)
                   ├─ delete ["q","status","dateFrom","dateTo","client","tags","agent","currency","page","clientsPage"]
                   ├─ set non-empty: q, status(csv), dateFrom, dateTo, client(csv), tags(csv), agent(csv), currency
                   └─ preserve unrelated params
     router.replace(`?${params}`, { scroll: false })
        └─ server re-renders /dashboard/trips → parseTripsSearchParams (page.tsx:72-100)
             └─ initialFilters changes → TripsExplorer key={JSON.stringify(initialFilters)} remounts
                  └─ <DashboardFilters> initialises filters ← deserializeTripFilters(searchParams)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/lib/trip-filters.ts` | Modify | Add `TRIP_FILTER_STATUSES`, `TRIP_FILTER_CURRENCIES`, `TRIP_FILTER_URL_KEYS`, `deserializeTripFilters`, `cleanTripFilters`, `buildTripFilterSearchParams`. Verbatim semantics from the component; reuses `normalizeFilterText`. |
| `src/lib/__tests__/trip-filter-url.test.ts` | Create | RED-first pin of the URL layer (parse/clean/build) plus the canonical normalize contract. |
| `src/app/dashboard/filters/FilterCombobox.tsx` | Create | `"use client"` generic single/multi combobox with internal transient state and the `clearOnEmptyBlur` quirk. |
| `src/app/dashboard/filters/FilterBadges.tsx` | Create | `"use client"` badges memo + render + `"Limpiar filtros"`; returns `null` when empty. |
| `src/app/dashboard/filters/FilterControls.tsx` | Create (conditional, on measurement) | `"use client"` status/date/currency group, created only if the shell would exceed ~300 lines. |
| `src/app/dashboard/DashboardFilters.tsx` | Modify | Shell: state, debounce, cleanup, sync/apply/update/clear handlers, text input, status/date/currency controls, three `<FilterCombobox>` and `<FilterBadges>`. Keeps path, export name and `data-testid`. Under ~300 lines. |
| `src/app/dashboard/trips/TripsExplorer.tsx` | Verify | No edit: call site `:91-97` and the `key={JSON.stringify(initialFilters)}` remount contract unchanged. |
| `src/app/dashboard/trips/page.tsx` | Verify | No edit: `parseTripsSearchParams` (`:72-100`) stays the server-side source of truth. |
| `src/lib/__tests__/trip-filters.test.ts` | Verify | No edit: `hasActiveTripFilters` / `tripMatchesFilters` pins stay green. |
| `src/app/dashboard/trips/__tests__/TripsExplorer.test.tsx` | Verify | No edit: still renders `DashboardFilters` and asserts `placeholder="Buscar por cliente o título de viaje…"`. |
| `e2e/local/dashboard.spec.ts` | Verify | No edit: URL round-trip (`:70-87`), `/dashboard` filter absence (`:35-36`), status checkbox (`:48-49`). |
| `architecture.md` | Modify/Verify | Add `dashboard/filters/` to the dashboard folder listing; optionally list `trip-filters.ts` in the lib listing. Leave untouched and record the decision if no entry aged. |
| `README.md` | Verify | Confirm the truth-source table needs no edit (technical → `architecture.md`). |

## Interfaces / Contracts

### `src/lib/trip-filters.ts` (extended)

```ts
import type { TripCurrency, TripFilters, TripStatus } from "@/types";

/** Literal vocabulary used by the URL parser. Moved from DashboardFilters.tsx:11. */
export const TRIP_FILTER_STATUSES: TripStatus[];      // ["draft", "published", "archived"]
/** Literal vocabulary used by the URL parser. Moved from DashboardFilters.tsx:17. */
export const TRIP_FILTER_CURRENCIES: TripCurrency[];  // ["MXN", "USD", "EUR"]
/** Frozen key list deleted before re-syncing. Moved verbatim from DashboardFilters.tsx:56. */
export const TRIP_FILTER_URL_KEYS: readonly [
  "q", "status", "dateFrom", "dateTo", "client", "tags", "agent", "currency", "page", "clientsPage",
];

/** Parses the query string into filters. Moved verbatim from DashboardFilters.tsx:456-480. */
export function deserializeTripFilters(searchParams: URLSearchParams): Partial<TripFilters>;

/** Drops empty values from a partial filters object. Moved verbatim from DashboardFilters.tsx:71-82. */
export function cleanTripFilters(filters: Partial<TripFilters>): Partial<TripFilters>;

/**
 * Pure core of syncUrl. Deletes TRIP_FILTER_URL_KEYS from `current`, then sets
 * each non-empty filter. Preserves unrelated params. Moved verbatim from :56-66.
 */
export function buildTripFilterSearchParams(
  current: URLSearchParams,
  filters: Partial<TripFilters>,
): URLSearchParams;
```

Contract: `deserializeTripFilters` keeps the current parse semantics including the untrimmed CSV split and the status/currency validation; `cleanTripFilters` keeps the current `delete`-on-empty behavior; `buildTripFilterSearchParams` keeps the key order and the `,`-join for the list filters. `normalizeFilterText` is unchanged and remains the canonical normalizer.

### `src/app/dashboard/filters/FilterCombobox.tsx` (client)

```tsx
"use client";

export type FilterComboboxOption = { id: string; name: string };

export function FilterCombobox({
  options,
  selectedIds,
  mode,
  placeholder,
  clearOnEmptyBlur = false,
  onSelect,
  onClear,
}: {
  options: FilterComboboxOption[];
  selectedIds: string[];
  mode: "single" | "multi";
  placeholder: string;
  clearOnEmptyBlur?: boolean;
  onSelect: (id: string) => void;
  onClear?: () => void;
}): React.ReactNode;
```

Contract: renders the `<div className="relative">` wrapper, the same input class string and `autoComplete="off"`, and (when open and there are results) the same `<ul>`/`<li>`/`<button>` markup with `onMouseDown={(e) => e.preventDefault()}`. Behavior: empty normalized query → no results; `mode === "multi"` excludes `selectedIds`; match on `normalizeFilterText(option.name)`; `slice(0, 8)`; `onFocus` opens; `onBlur` closes after 150 ms and — only when `clearOnEmptyBlur` and `!justSelected.current` and the query is blank and `selectedIds.length` — calls `onClear()`. No hook or state is exported to the shell.

### `src/app/dashboard/filters/FilterBadges.tsx` (client)

```tsx
"use client";

export function FilterBadges({
  filters,
  clients,
  tags,
  travelAgents,
  statusLabels,
  onUpdate,
  onClearAll,
}: {
  filters: Partial<TripFilters>;
  clients: Client[];
  tags: Tag[];
  travelAgents?: TravelAgent[];
  statusLabels: Record<TripStatus, string>;
  onUpdate: (update: Partial<TripFilters>) => void;
  onClearAll: () => void;
}): React.ReactNode;
```

Contract: builds badges in the same order (query, each status, date range, each client, each tag, each agent, currency) with the same labels and keys (`` `status-${s}` ``, `client-${cid}`, `tag-${tid}`, `agent-${aid}`, `date`, `query`, `currency`); renders the same `<span>`/`<button aria-label={\`Quitar filtro ${label}\`}>×` markup and the same `"Limpiar filtros"` button; returns `null` when the badge list is empty. The `activeBadges` memo keeps `// eslint-disable-next-line react-hooks/exhaustive-deps` and the `[filters, clients, tags, travelAgents]` dep array.

### `src/app/dashboard/DashboardFilters.tsx` (client shell)

Public surface unchanged: named export `DashboardFilters`, same props (`onChange`, `clients`, `tags`, `travelAgents?`), same `data-testid="trip-filters"`. Initial state still comes from the URL, so the parent's `key={JSON.stringify(initialFilters)}` remount resyncs the controlled inputs.

## Testing Strategy

`strict_tdd: true`. Honest applicability: the URL layer has a deterministic Vitest pin with a clear expected outcome and is written first; the combobox/badge moves have no applicable deterministic test in this repo without adding a rendering/blur harness, and are verified by byte-level diff review plus the existing unit/e2e nets.

| Step | What runs | Expected result |
|------|-----------|-----------------|
| RED | `npm run test -- trip-filter-url` after adding the pin but before the lib exports exist | Fails: `deserializeTripFilters` / `cleanTripFilters` / `buildTripFilterSearchParams` / `TRIP_FILTER_URL_KEYS` are not exported. Deterministic, no React render. |
| GREEN | Add the exports to `src/lib/trip-filters.ts` moving the bodies verbatim; rerun the pin | The pin passes and the parser/builder behavior is unchanged. |
| TRIANGULATE | Pin the negative/alternate cases: invalid status filtered out, invalid currency ignored, `client=` trailing comma, unrelated params preserved, `page`/`clientsPage` deleted, `clean` drops empties, canonical `normalizeFilterText` accent folding | All pass; the URL contract and the de-dup decision are both pinned. |
| REFACTOR | Extract `FilterCombobox` and `FilterBadges`, trim the shell; re-run `npm run test` and `wc -l` | Unit suite green (including `TripsExplorer.test.tsx`); every file under ~300 lines; no copy/class/branch drift in the moved blocks. |
| E2E | `npm run test:e2e -- --project=local` with the Supabase stack up | `dashboard.spec.ts` green: URL prefill, typing → URL, `page`/`clientsPage` reset, `/dashboard` has no filters. |

| Layer | What verifies | Approach |
|-------|---------------|----------|
| Unit (lib pin) | URL parse/clean/build, key list, normalize equivalence | new `src/lib/__tests__/trip-filter-url.test.ts` (**the RED**) |
| Unit (domain) | Server-side filter matching untouched | existing `src/lib/__tests__/trip-filters.test.ts`, unmodified |
| Unit (component, indirect) | Shell text-input markup rendered through `TripsExplorer` | existing `src/app/dashboard/trips/__tests__/TripsExplorer.test.tsx`, unmodified |
| E2E (local) | URL round-trip, `/dashboard` filter absence, status checkbox | existing `e2e/local/dashboard.spec.ts`, unmodified |
| Type/build/lint | Prop shapes, lib exports, `"use client"` placement | `npx tsc --noEmit`, `npm run lint`, `npm run build` |
| Size | Every file under budget | `wc -l` over the shell + `filters/*` + the lib module |
| Manual/review (gap) | Combobox option lists, client clear-on-blur, badge removal, 300 ms debounce | **No automated test exists** (no component harness); covered by byte-level diff review only — recorded as a residual risk, not claimed as verified |

## Threat Matrix

N/A — this change introduces no shell/CLI routing, subprocess execution, VCS/PR automation, executable classification, or process-integration edge. It is a static code move among `src/lib` and `src/app/dashboard` modules with no new inputs, network calls, or execution surface.

## Migration / Rollout

- **Data/schema**: no migrations. Nothing under `supabase/migrations/` or `supabase/seed.sql` changes.
- **Rollout**: single PR; the effect is internal only. No feature flag needed because behavior is unchanged.
- **Compatibility**: the component path, export name, props, `data-testid`, the `onChange` no-op contract, the URL source of truth and the parent remount key are preserved. `src/lib/data*`, `trips/page.tsx` and Server Actions are untouched.
- **Rollback**: revert the commits; delete `src/app/dashboard/filters/` and the new pin test; drop the added exports from `trip-filters.ts`; `DashboardFilters.tsx` returns to its pre-refactor version. No test outside the change was modified, so no test revert is needed.
- **Docs**: `architecture.md` is the technical source of truth; record `dashboard/filters/` in the dashboard listing and verify the `README.md` truth-source table in the same PR.
- **PR sequencing**: PR 2 and PR 3 also edit neighbouring regions of the dashboard/lib listings. Keep each added line and do not reorder existing entries, to minimize the merge surface.

## Open Questions

- [ ] Should `trip-filters.ts` also be listed in the `architecture.md` lib block (it is not today), or is extending an existing but unlisted module enough? Proposed: add `dashboard/filters/` (the listing records folders) and leave the lib listing alone, recording the decision.
- [ ] Should the verdict on the local `normalize` be "remove" or "keep"? Proposed: remove and import `normalizeFilterText`, since the chains are byte-identical and the pin asserts the canonical output; keep the local copy only on an observed divergence.
- [ ] Should `FilterControls.tsx` (status/date/currency group) ship by default or only on measurement? Proposed: measurement decides, mirroring PR 3's conditional summary extraction; create it only if the shell exceeds ~300 lines.
- [ ] Should a component test harness be introduced so the combobox/badge behavior stops being review-only? Proposed: no, out of scope for a pure move; recorded as a coverage gap and a candidate follow-up.
- [ ] Should `statusLabels` be a prop on `FilterBadges` or live in a co-located `filter-constants.ts`? Proposed: keep the prop (one source, no extra file); revisit if a third consumer appears.

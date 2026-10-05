# Tasks: Split `DashboardFilters.tsx` into a URL library, a generic combobox, and a badges component

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~820 (range 650–1,000) |
| 400-line budget risk | High |
| 800-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | 1 PR with work-unit commits (URL pin RED → lib move GREEN → combobox extraction → badges extraction → shell trim → docs → verification) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |
| Decision needed before apply | No — the >400-lines exception is already documented in `proposal.md` ("Size Exception") and `design.md` (D11) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High
800-line budget risk: Medium

**Size exception (required by `architecture.md:427-428`)**: this is a mechanical move of roughly 300 lines out of a 480-line client component into an existing lib module and up to three co-located files, plus a ~120-line pin test. The diff is large in moved lines and small in new logic; the exception and its rationale (single PR, work-unit commits, byte-level reviewer guidance) are documented in `proposal.md` and `design.md` (D11).

### Suggested Work Units

| Unit | Objective | Likely PR | Estimated lines | Effort | Focused test command | Rollback boundary |
|------|-----------|-----------|-----------------|--------|----------------------|-------------------|
| 1 | URL-layer pin (RED) | PR 4 | ~130 | ~2 h | `npm run test -- trip-filter-url` | `src/lib/__tests__/trip-filter-url.test.ts` only |
| 2 | Move URL bodies to `src/lib/trip-filters.ts` (GREEN) + de-dup `normalize` | PR 4 | ~140 | ~2.5 h | `npm run test -- trip-filter-url trip-filters` | `src/lib/trip-filters.ts`, shell imports |
| 3 | Extract `FilterCombobox` and replace the three call sites | PR 4 | ~230 | ~4 h | `npm run test -- TripsExplorer` + `wc -l` | `src/app/dashboard/filters/FilterCombobox.tsx` + shell combobox blocks |
| 4 | Extract `FilterBadges` (memo + lint directive preserved) | PR 4 | ~130 | ~2 h | `npm run test` | `src/app/dashboard/filters/FilterBadges.tsx` + shell badges block |
| 5 | Shell trim + size budget (+ conditional `FilterControls`) | PR 4 | ~60 | ~1.5 h | `wc -l` + `npm run test` | `DashboardFilters.tsx`, conditional `FilterControls.tsx` |
| 6 | Doc freshness: `architecture.md` `dashboard/filters/`; verify `README.md` | PR 4 | ~5 | ~0.5 h | — | `architecture.md` only |
| 7 | Verification: tsc, lint, unit, build, e2e local | — | ~10 | ~2 h | see Phase 6 | — |

**Total estimated effort**: ~14.5 h of agent work.

> Line estimates are diff-accounting estimates for moved blocks (deletions in `DashboardFilters.tsx` + insertions in the new files) and therefore overlap: they sum to more than the forecast because the same lines are counted once when removed and once when added. The forecast row is the authoritative size estimate.

## Phases

### Phase 1 — Test-first URL pin (WU1, TDD RED)

- [ ] 1.1 Read `src/app/dashboard/DashboardFilters.tsx:54-82` and `:456-480` and transcribe the current URL behavior into `src/lib/__tests__/trip-filter-url.test.ts`, importing `deserializeTripFilters`, `cleanTripFilters`, `buildTripFilterSearchParams` and `TRIP_FILTER_URL_KEYS` from `@/lib/trip-filters` (the exports do not exist yet).
- [ ] 1.2 Pin `deserializeTripFilters` for a fully-populated URL: `q`, `status` (CSV validated to `draft|published|archived`), `dateFrom`, `dateTo`, `client` → `clientIds`, `tags` → `tagIds`, `agent` → `agentIds`, `currency` (validated to `MXN|USD|EUR`).
- [ ] 1.3 Pin the defaults and empty handling: an empty URL yields `{}`; blank `q`/`dateFrom`/`dateTo` are omitted; `status` with no valid value is omitted; invalid `currency` (`BAD`) is ignored.
- [ ] 1.4 Pin the exact CSV semantics, including the non-obvious cases: `client=a,b` → `["a","b"]`; `client=a,` → `["a",""]` (no trimming); `status=draft,bogus` → `["draft"]` and `status=bogus` → key absent.
- [ ] 1.5 Pin `cleanTripFilters`: drops `query: ""`, `status: []`, `tagIds: []`, `agentIds: []`, `undefined` dates and `currency`; keeps every truthy value; returns a new object (does not mutate the input).
- [ ] 1.6 Pin `buildTripFilterSearchParams`: deletes the exact `TRIP_FILTER_URL_KEYS` tuple — asserted literally, including `page` and `clientsPage`; sets each non-empty filter in the original key order; joins list filters with `,`; **preserves unrelated params** (e.g. `foo=bar`); does not emit a key for an empty filter.
- [ ] 1.7 Pin the canonical normalizer: assert `normalizeFilterText` folds accents and case (`"Cancún"` → `"cancun"`, `"PÉREZ"` → `"perez"`). This is the equivalence evidence for removing the component's local `normalize` (D9).
- [ ] 1.8 Run `npm run test -- trip-filter-url` and record the observed RED (the four exports are not available). Do not add the lib exports yet.

### Phase 2 — Move the URL layer into `src/lib/trip-filters.ts` (WU2, TDD GREEN)

- [ ] 2.1 Add `TRIP_FILTER_STATUSES` (`["draft","published","archived"]`) and `TRIP_FILTER_CURRENCIES` (`["MXN","USD","EUR"]`) to `src/lib/trip-filters.ts`, replacing the literals currently inline in `deserializeFilters`.
- [ ] 2.2 Add `TRIP_FILTER_URL_KEYS` as the exact tuple from `DashboardFilters.tsx:56` (`["q","status","dateFrom","dateTo","client","tags","agent","currency","page","clientsPage"]`). No key added or removed.
- [ ] 2.3 Move `deserializeFilters` (`:456-480`) verbatim to `src/lib/trip-filters.ts` as `deserializeTripFilters`, keeping the same validation, the same untrimmed CSV split and the same omission rules.
- [ ] 2.4 Move `clean` (`:71-82`) verbatim as `cleanTripFilters`.
- [ ] 2.5 Move the pure core of `syncUrl` (`:56-66`) as `buildTripFilterSearchParams(current, filters)`, returning a new `URLSearchParams` (delete keys → set non-empty filters → preserve unrelated params). Do not move `router.replace`.
- [ ] 2.6 De-duplicate `normalize`: delete the local `normalize` (`:7-9`) and import `normalizeFilterText` from `@/lib/trip-filters` where the comboboxes will use it (Phase 3). Only after 1.7 confirms equivalence; otherwise keep the local copy, record the divergence in the PR, and skip the import.
- [ ] 2.7 Rewire the shell: `useState(() => deserializeTripFilters(searchParams))`, `const next = cleanTripFilters(nextFilters)` inside `applyFilters`, and `syncUrl` reduced to `router.replace(\`?${buildTripFilterSearchParams(new URLSearchParams(searchParams.toString()), f).toString()}\`, { scroll: false })`. Delete `deserializeFilters` and `clean` from the component.
- [ ] 2.8 Run `npm run test -- trip-filter-url trip-filters` — GREEN for both files. Record the result.

### Phase 3 — Extract `FilterCombobox` and replace the three call sites (WU3)

- [ ] 3.1 Create `src/app/dashboard/filters/FilterCombobox.tsx` with `"use client"`, props `options`, `selectedIds`, `mode`, `placeholder`, `clearOnEmptyBlur?`, `onSelect`, `onClear?`.
- [ ] 3.2 Move the transient state into it: `query`, `open` and the `justSelected` ref (today `clientJustSelected` at `:45`, plus the three `query`/`open` pairs at `:195-228`). Do not accept query/open as props.
- [ ] 3.3 Reproduce the result rule exactly: `const q = normalizeFilterText(query.trim()); if (!q) return [];` then, for `mode === "multi"`, exclude ids in `selectedIds`, then `normalizeFilterText(option.name).includes(q)`, then `.slice(0, 8)`.
- [ ] 3.4 Reproduce the markup byte-for-byte: the `<div className="relative">` wrapper, the input with the same class string, `autoComplete="off"`, the same `onFocus={() => setOpen(true)}` and `onChange` (set query + open), the same `<ul>`/`<li>`/`<button type="button" onMouseDown={(e) => e.preventDefault()}>` and the same item class string.
- [ ] 3.5 Reproduce the blur handler: `setTimeout(() => setOpen(false), 150)`, then the guarded clear `if (clearOnEmptyBlur && !justSelected.current && !query.trim() && selectedIds.length) onClear?.();`, then `justSelected.current = false`. Keep the explanatory comment about clearing the client filter.
- [ ] 3.6 Set `justSelected.current = true`, clear the query and close the list inside the option `onClick`, **before** calling `onSelect(id)`, mirroring the current `:294-300`.
- [ ] 3.7 Replace the client combobox (`:266-310`) with `<FilterCombobox mode="single" options={clients} selectedIds={filters.clientIds ?? []} placeholder="Filtrar por cliente…" clearOnEmptyBlur onSelect={(id) => updateFilters({ clientIds: [id] }, true)} onClear={() => updateFilters({ clientIds: undefined }, true)} />`.
- [ ] 3.8 Replace the tags combobox (`:311-348`) with `<FilterCombobox mode="multi" options={tags} selectedIds={filters.tagIds ?? []} placeholder="Filtrar por tags…" onSelect={(id) => updateFilters({ tagIds: [...(filters.tagIds ?? []), id] }, true)} />`. Do **not** pass `clearOnEmptyBlur`.
- [ ] 3.9 Replace the agent combobox (`:349-388`) only inside its existing `travelAgents && travelAgents.length > 0` guard, with the equivalent `agentIds` append. Keep the guard in the shell.
- [ ] 3.10 Run `npm run test -- TripsExplorer` (the shell still renders the search placeholder and status checkboxes) and `wc -l "src/app/dashboard/filters/FilterCombobox.tsx"`. Re-read the moved blocks against the deleted ones for byte-level equivalence.

### Phase 4 — Extract `FilterBadges` (WU4)

- [ ] 4.1 Create `src/app/dashboard/filters/FilterBadges.tsx` with `"use client"` and props `filters`, `clients`, `tags`, `travelAgents`, `statusLabels`, `onUpdate`, `onClearAll`.
- [ ] 4.2 Move the `activeBadges` memo (`:114-193`) verbatim: the same badge order, the same keys, the same labels (`"${query}"`, `STATUS_LABELS[s]`, `[dateFrom, dateTo].join(" – ")`, client/tag/agent name fallback to id, currency), and the same `onRemove` handlers calling `onUpdate({ ... })`.
- [ ] 4.3 **Keep the `// eslint-disable-next-line react-hooks/exhaustive-deps` comment and the exact dep array `[filters, clients, tags, travelAgents]`.** Do not add `statusLabels`, `onUpdate` or `onClearAll` to the deps.
- [ ] 4.4 Move the badges render (`:424-452`) verbatim: the `length > 0` guard is replaced by returning `null` from the component, so the shell's `{activeBadges.length > 0 && ...}` disappears with identical DOM output; keep the same `<span>` key, class string, `aria-label={\`Quitar filtro ${label}\`}`, `×` button and the `"Limpiar filtros"` button calling `onClearAll`.
- [ ] 4.5 Render `<FilterBadges ... onUpdate={(update) => updateFilters(update, true)} onClearAll={clearAll} />` from the shell, passing `statusLabels={STATUS_LABELS}` and the lookup arrays. Delete the memo and the badges block from the shell.
- [ ] 4.6 Run `npm run test` — suite green; no assertion changed.

### Phase 5 — Shell trim, size budget, and doc freshness (WU5)

- [x] 5.1 Confirm the shell holds only: imports, JSDoc, props interface, `filters` state (from the URL), `debounceRef`, the unmount cleanup, `syncUrl` (build + `router.replace`), `cleanTripFilters` usage inside `applyFilters`, `updateFilters`, `clearAll`, `STATUS_LABELS`, and the JSX composition (text search, status checkboxes, three `<FilterCombobox>`, date range, currency select, `<FilterBadges>`).
- [x] 5.2 Confirm no `useEffect` was added beyond the existing unmount cleanup, and that `clientQuery`/`tagQuery`/`agentQuery`/`clientOpen`/`tagOpen`/`agentOpen` no longer exist in the shell.
- [x] 5.3 Measure `wc -l src/app/dashboard/DashboardFilters.tsx src/app/dashboard/filters/FilterCombobox.tsx src/app/dashboard/filters/FilterBadges.tsx src/lib/trip-filters.ts src/lib/__tests__/trip-filter-url.test.ts`; every file MUST be under ~300 lines (shell target ~240–290).
- [x] 5.4 If the shell exceeds ~300 lines, extract the status/date/currency control group into `src/app/dashboard/filters/FilterControls.tsx` (`"use client"`), moving the checkboxes, the two date inputs and the currency `<select>` verbatim, and re-measure. Do not accept a partial split.
- [x] 5.5 Confirm `TripsExplorer.tsx:91-97` is untouched: `key={JSON.stringify(initialFilters)}`, `onChange={() => undefined}`, `clients`, `tags`, `travelAgents` all unchanged.
- [x] 5.6 Doc freshness: add a `dashboard/filters/` line to the `architecture.md` dashboard folder listing (which records co-located folders: `trips/[id]/sections/`, `trips/[id]/service-checklist/`), or record the decision to leave it untouched if no entry aged; decide whether to list `trip-filters.ts` in the lib block and record the decision.
- [x] 5.7 Verify the `README.md` truth-source table ("Tecnica (como esta hecho)" → `architecture.md`); confirm no README edit is required, or edit it if a row aged.

### Phase 6 — Verification (WU6)

- [ ] 6.1 `npx tsc --noEmit` — no type errors.
- [ ] 6.2 `npm run lint` — no new lint errors in changed files, and the moved `activeBadges` memo still passes without a new exhaustive-deps warning.
- [ ] 6.3 `npm run test` — full unit suite green: the new `trip-filter-url.test.ts`, the existing `trip-filters.test.ts` and `TripsExplorer.test.tsx` (the indirect shell markup net), all unmodified except the new file.
- [ ] 6.4 `npm run build` — production build clean.
- [ ] 6.5 Start the local Supabase stack and run `npm run test:e2e -- --project=local` — green. This is the behavioral net for the URL round-trip (`dashboard.spec.ts:70-87`), `/dashboard` having no filters (`:35-36`) and the status checkbox (`:48-49`).
- [ ] 6.6 Re-confirm the size budget from 5.3 and that no file outside the planned change set was modified (`src/lib/trip-filters.ts`, the new `filters/*`, the new pin, `DashboardFilters.tsx`, and `architecture.md` only — no change to `TripsExplorer.tsx`, `trips/page.tsx`, `trip-filters.test.ts`, `TripsExplorer.test.tsx` or `e2e/local/dashboard.spec.ts`).
- [ ] 6.7 Report evidence per command (exact command + observed result), the honest RED/GREEN/TRIANGULATE sequence, and any pre-existing failure not attributable to this change.

### Verification mapping (honest per-layer coverage)

| Layer | Proves | Status in this change |
|-------|--------|-----------------------|
| `src/lib/__tests__/trip-filter-url.test.ts` (new) | URL parse, clean, build, key list, normalize equivalence | **RED-first pin** — the change's only true RED |
| `src/lib/__tests__/trip-filters.test.ts` (existing) | Server-side filter matching | Net, unmodified |
| `src/app/dashboard/trips/__tests__/TripsExplorer.test.tsx` (existing) | Shell text-input markup through `TripsExplorer` render | Net, unmodified; **not a dedicated `DashboardFilters` test** |
| `e2e/local/dashboard.spec.ts` (existing) | URL round-trip, `/dashboard` filter absence, status checkbox | Behavioral net, unmodified |
| Component test for combobox behavior / badges / debounce timing | Option lists, client clear-on-blur, badge removal, 300 ms debounce | **Does not exist.** No `@testing-library/react` in the repo; `renderToStaticMarkup` cannot exercise blur/typing/timers. Covered by byte-level diff review only — recorded as a residual risk, never claimed as verified. |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | Types, lint (incl. the preserved memo directive), client/server boundaries | Required battery |
| `wc -l` | File-size budget | Required measurement |

# Tasks: Split `trips/[id]/page.tsx` into co-located editor sections

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1,350 (range 1,100–1,700) |
| 400-line budget risk | High |
| 800-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | 1 PR with work-unit commits (pin update → meta module → header/days nav → center → right rail → page trim + docs → verification) |
| Delivery strategy | single-pr |
| Chain strategy | size-exception |
| Decision needed before apply | No — the >400-lines exception is already documented in `proposal.md` and `design.md` (D8) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High
800-line budget risk: High

**Size exception (required by `architecture.md:427-428`)**: this is a mechanical move of ~660 JSX lines out of `page.tsx` into ~6 new section files. The diff is large in moved lines and small in new logic; the exception is documented in `proposal.md` ("Size Exception") and `design.md` (D8), which also records why chained PRs were rejected (a pure move is only reviewable side-by-side, and intermediate slices leave the pin test and DOM order half-migrated).

### Suggested Work Units

| Unit | Objective | Likely PR | Estimated lines | Effort | Focused test command | Rollback boundary |
|------|-----------|-----------|-----------------|--------|----------------------|-------------------|
| 1 | Repoint the structural pin test at `sections/*` (RED) | PR 2 | ~20 | ~1 h | `npm run test -- page` | `__tests__/page.test.ts` only |
| 2 | Move `statusMeta` + `countDaysInRange` into `sections/trip-editor-meta.ts` | PR 2 | ~40 | ~1 h | `npm run test -- page` | `sections/trip-editor-meta.ts`, page imports |
| 3 | Extract `TripHeaderSection` + `DaysNavSection` (GREEN for those blocks) | PR 2 | ~160 | ~2 h | `npm run test -- page` | the two section files, page call sites |
| 4 | Extract `ItinerarySection` + `DayCard` (the big win, ~660 → ~380 lines moved) | PR 2 | ~420 | ~4 h | `npm run test -- page` | the two section files, page call sites |
| 5 | Extract `TripSidebarActionsSection` + `TripSidebarDetailsSection` | PR 2 | ~420 | ~4 h | `npm run test -- page` | the two section files, page call sites |
| 6 | Page trim to composer, size budget, doc freshness | PR 2 | ~250 | ~2 h | `wc -l` + `npm run test -- page` | `page.tsx` composer JSX, `architecture.md` entry |
| 7 | Verification: tsc, lint, unit, build, e2e local | — | ~10 | ~1.5 h | see Phase 7 | — |

**Total estimated effort**: ~15.5 h of agent work.

> Line estimates are diff-accounting estimates for moved blocks (deletions in `page.tsx` + insertions in the new files) and therefore overlap: they sum to more than the forecast above because the same lines are counted once when removed and once when added. The forecast row is the authoritative size estimate.

## Phases

### Phase 1 — Structural pin update (WU1, TDD RED)

- [ ] 1.1 Read `src/app/dashboard/trips/[id]/__tests__/page.test.ts` and record the exact current assertion set: `bg-[#4a1834]`, `border-[#f0bd79]/35`, `bg-[#fdf7f3]`, `mt-1 text-sm text-[#f7dfbc]`, `TripPublishSubmitButton`, `ServiceChecklistManager`, and the copy `Las acciones de edición están bloqueadas mientras el viaje está publicado.`.
- [ ] 1.2 Update the read set to load `../page.tsx` plus every expected `../sections/*.tsx` file (`TripHeaderSection.tsx`, `DaysNavSection.tsx`, `ItinerarySection.tsx`, `DayCard.tsx`, `TripSidebarActionsSection.tsx`, `TripSidebarDetailsSection.tsx`), joined into one string before the assertions run.
- [ ] 1.3 Do not change, add, reorder, or narrow any assertion. The assertion set after the edit MUST be identical to 1.1.
- [ ] 1.4 Run `npm run test -- page` and record the observed RED (the section files cannot be read yet). Do not create the section files in this phase.

### Phase 2 — Extract the shared module helpers (WU2)

- [ ] 2.1 Create `src/app/dashboard/trips/[id]/sections/trip-editor-meta.ts` and move `statusMeta` (`page.tsx:44-48`) verbatim, with the same keys, labels, and class strings.
- [ ] 2.2 Move `countDaysInRange` (`page.tsx:862-870`) verbatim into the same module, with the same null semantics and inclusive day count.
- [ ] 2.3 Import `countDaysInRange` in `page.tsx` (for `tripDateRangeDays`) and `statusMeta` wherever the page still renders it (header badge, status history) until those blocks are extracted.
- [ ] 2.4 Run `npm run test -- page` — still RED for the missing section files, but no new failure from the meta move.

### Phase 3 — Extract `TripHeaderSection` and `DaysNavSection` (WU3)

- [ ] 3.1 Create `src/app/dashboard/trips/[id]/sections/TripHeaderSection.tsx` (Server Component, no directive) and move the header/publish block (`page.tsx:168-221`) plus the published-lock banner (`:223-227`) verbatim: title, `statusMeta` badge, assigned clients/traveler count line, date range, tag list, publish `form action`, `TripPublishSubmitButton`, preview link (`travelerHref`, `Vista previa borrador` / `Vista previa`), quote link, `CopyUrlButtonClient` + `ShareWhatsAppButton` when published.
- [ ] 3.2 Props: `trip`, `travelerHref`, `onTogglePublish` (the page passes `publishTripStatusAction.bind(null, trip.id, trip.status === "published" ? "draft" : "published")`).
- [ ] 3.3 Create `src/app/dashboard/trips/[id]/sections/DaysNavSection.tsx` (Server Component) and move the left aside (`page.tsx:231-283`) verbatim: sticky card, "Días del viaje", day anchors `#day-${day.id}` with the per-day item counter classes, add-day `DayFormDialog` whose trigger button carries `id={ADD_DAY_TRIGGER_ID}`, and `GenerateDaysButton` gated by `tripDateRangeDays !== null`. Keep the `isEditable` gate.
- [ ] 3.4 Props: `trip`, `isEditable`, `tripDateRangeDays`, `onAddDay` (`addDayAction.bind(null, trip.id)`), `onGenerateDays` (`generateTripDaysAction.bind(null, trip.id)`).
- [ ] 3.5 Render both sections from `page.tsx` and delete the moved blocks.
- [ ] 3.6 Run `npm run test -- page` — still RED until every section file exists.

### Phase 4 — Extract `ItinerarySection` and `DayCard` (WU4)

- [ ] 4.1 Create `src/app/dashboard/trips/[id]/sections/ItinerarySection.tsx` (Server Component): "Itinerario por días" card, "Ir al último día" link gated by `trip.days.length > 0`, the `trip.days.map` loop rendering `DayCard` keyed by `day.id`, and the mobile add-day row (`page.tsx:585-590`) — with no `id` on the mobile add-day button.
- [ ] 4.2 Create `src/app/dashboard/trips/[id]/sections/DayCard.tsx` (Server Component) and move the day card body verbatim: wrapper `id={`day-${day.id}`}` and classes, "Día n" label, `formatDateLong(day.date)`, `WeatherBadge`, the `isEditable` reorder/edit controls (`ReorderButtons`, `DayFormDialog` with `editDayAction` / `deleteDayAction` / `restoreDayAction`), the day-notes block, the item rows (`ItemTypeIcon`, title, start time + `tzLabel`, `FlightStatusBadge` for flights, resolved location, cost, confirmation code, `formatItemMetadataSummary`, `LocationActions`, and the edit/duplicate/move item controls), the empty-day message copy, and the add-item `ItemFormDialog`.
- [ ] 4.3 Preserve the trigger id exactly: the add-item trigger button carries `id={isLastDay ? ADD_ITEM_LAST_DAY_TRIGGER_ID : undefined}`; no other add-item button may carry it.
- [ ] 4.4 Props: `trip`, `day`, `dayIndex` (from `dayOrder`), `isLastDay`, `weather` (from `dayWeather[dayWeatherIdx]`), `isEditable`, `allSuppliers`, `documentsEnabled`, and the bound day/item actions. Derive `itemOrder` locally from `day.items`.
- [ ] 4.5 Keep `dayOrder` and `dayWeather` computed in the page and pass them down; keep `resolveItemLocation`, `getApproxUtcOffsetLabel`, `formatCost`, and `formatItemMetadataSummary` usage unchanged.
- [ ] 4.6 Render `ItinerarySection` from `page.tsx` and delete the moved center column.
- [ ] 4.7 Run `npm run test -- page` — still RED until every section file exists.

### Phase 5 — Extract the right-rail sections (WU5)

- [ ] 5.1 Create `src/app/dashboard/trips/[id]/sections/TripSidebarActionsSection.tsx` (Server Component) with the Acciones card (`page.tsx:592-~708`), the Finanzas card (`~710-745`), and the Completitud card (`~747-772`), moved verbatim: edit controls, the exact published-lock copy `"Las acciones de edición están bloqueadas mientras el viaje está publicado."`, `CopyTripSummaryButtonClient`, `SaveAsTemplateDialog`, `DuplicateTripButton`, `PrintButton`, the cost/budget/budget-diff branches with `formatCost`, and the completeness bar with `completeness.documentPercentage` / `itemsWithDocuments` / `emptyDays` messages.
- [ ] 5.2 Props: `trip`, `isEditable`, `clients`, `tags`, `travelAgents`, `internalNotes`, `totalCost`, `hasAnyCost`, `budgetDiff`, `completeness`, and the bound action/manager callbacks.
- [ ] 5.3 Create `src/app/dashboard/trips/[id]/sections/TripSidebarDetailsSection.tsx` (Server Component) with cover (`TripCoverImage`), photos (`TripPhotoGallery`), documents (`TripDocuments`), `ServiceChecklistManager`, status history (`trip.statusHistory.length > 0`, reversed last 3, `statusMeta` labels via `formatDateTime`), feedback (`feedback.length > 0`, rating and comment), packing (`PackingListManager` when editable), and the danger zone (`DeleteTripDialog`), all moved verbatim (`~774-850`).
- [ ] 5.4 Props: `trip`, `isEditable`, `clientNameById`, `serviceDocumentSummaries`, `feedback`, `documentsEnabled`, `photosEnabled`, `coversEnabled`, and the bound actions. Keep `isArchived={trip.status === "archived"}` and pass all nine checklist actions unchanged.
- [ ] 5.5 Render both rail sections from `page.tsx` inside the right `<aside className="space-y-4 print:hidden">` and delete the moved blocks.
- [ ] 5.6 Run `npm run test -- page` — GREEN expected once all six section files exist.

### Phase 6 — Page trim, size budget, and doc freshness (WU6)

- [x] 6.1 Confirm `page.tsx` holds only: imports, env flags (`documentsEnabled` / `photosEnabled` / `coversEnabled`), `TripEditorPage` with data loading + `getTripFeedback` + per-day `getDailyWeather`, the derived aggregates, all `action.bind(...)` expressions, the back link, the `<main>` shell, the section composition, `TripEditorShortcuts`, and `UndoToastHost`.
- [x] 6.2 If `page.tsx` still exceeds ~300 lines because of the ~48 action bindings, group the per-section bound actions into one object prop per section (fallback from design D2) or split a rail section further. Do not accept a partial extraction.
- [x] 6.3 Measure `wc -l src/app/dashboard/trips/[id]/page.tsx src/app/dashboard/trips/[id]/sections/*.ts(x)`; `page.tsx` and every section file MUST be under ~300 lines.
- [x] 6.4 Confirm every section is a Server Component (no `"use client"`) and that no new client component or state was introduced.
- [x] 6.5 Confirm the trigger contract: exactly one element carries `ADD_DAY_TRIGGER_ID` and one carries `ADD_ITEM_LAST_DAY_TRIGGER_ID`, on the same buttons as before; the mobile add-day button still has no id.
- [x] 6.6 Doc freshness: check the `architecture.md` folder listing that enumerates `trips/[id]/` and nested route folders; add `trips/[id]/sections/` if that listing enumerates them, otherwise leave `architecture.md` untouched and record the decision in the PR.
- [x] 6.7 Verify the `README.md` truth-source table ("Técnica (cómo está hecho)" → `architecture.md`); confirm no README edit is required, or edit it if a row aged.

### Phase 7 — Verification (WU7)

- [x] 7.1 `npx tsc --noEmit` — no type errors.
- [x] 7.2 `npm run lint` — no new lint errors in changed files.
- [x] 7.3 `npm run test` — unit suite green; `page.test.ts` green with the same seven assertions, `actions.test.ts` and `ServiceChecklistManager.test.tsx` unmodified.
- [x] 7.4 `npm run build` — production build clean.
- [x] 7.5 Start the local Supabase stack and run `npm run test:e2e -- --project=local` — green. This is the behavioral net for publish toggle, day/item CRUD, documents, checklist, traveler activities, and visibility links.
- [x] 7.6 Re-confirm the size budget from 6.3 and that no file outside the planned change set was modified.
- [x] 7.7 Report evidence per command (exact command + observed result), the RED/GREEN/TRIANGULATE sequence from Phases 1–5, and any pre-existing failure not attributable to this change.

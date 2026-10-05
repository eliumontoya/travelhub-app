# Design: Split `trips/[id]/page.tsx` into co-located editor sections

## Technical Approach

Reduce `src/app/dashboard/trips/[id]/page.tsx` (870 lines) to a composer under ~300 lines by moving its JSX into co-located Server Component sections along the seams the render already has:

1. **The module helpers** (`statusMeta`, `countDaysInRange`) leave the page for `sections/trip-editor-meta.ts`, because they are shared by more than one render region (header + status history; days nav + mobile add-day row).
2. **The three-column grid becomes three composition slots** — header/banner above the grid, then left aside, center itinerary, right rail — each rendered by one section file (the center and the right rail split further to stay under budget).
3. **The page keeps ownership of everything that is not presentation**: data loading, env flags, every `action.bind(...)`, the derived aggregates that cross sections, `TripEditorShortcuts`, and `UndoToastHost`.

Nothing in the page has state (`useState`/`useEffect` count: zero), so this is a pure composition extraction: props in, JSX out. Every extracted section is a Server Component; no `"use client"` is introduced, and bound Server Actions continue to be passed down as props exactly like the page passes them to client dialogs today.

`strict_tdd` applies to the only real behavior-adjacent artifact in this change: the structural pin test. `__tests__/page.test.ts` currently reads `page.tsx` as raw text; it is updated first (RED: the section files it now reads do not exist) and then made green by the extraction, without changing a single assertion.

## Architecture Decisions

### Decision: Sections are Server Components under a co-located `sections/` folder (D1)

**Choice**: All extracted files live in `src/app/dashboard/trips/[id]/sections/` as Server Components (no directive), co-located with the route they compose.

**Alternatives considered**:
- *Put the sections in `src/components/`* — rejected: these sections are route-specific (they render this trip's header, this trip's day cards, this trip's rail). `src/components/` is the shared-component surface; the repo already co-locates route components (`ClientsExplorer.tsx`, `TripsExplorer.tsx`, `wcc/components.tsx`).
- *Make the sections client components to avoid prop plumbing* — rejected: it would move `"use client"` boundaries, force every bound action across the client boundary, and change bundle behavior. The page has no state, so there is nothing to push down.
- *Keep one `sections.tsx` file with all sections* — rejected: it would not meet the ~300-line budget (that is the problem being solved).

**Rationale**: Server Components rendering read-only JSX from props is exactly the shape the page already uses for its non-interactive regions. Co-location keeps the review surface next to `page.tsx`, `actions.ts` and `loading.tsx`.

### Decision: The page owns the composition contract; sections receive bound actions (D2)

**Choice**: The page keeps every `action.bind(...)` expression and passes the resulting function to the section that renders it. Sections MUST NOT import `./actions` to create their own bindings.

**Alternatives considered**:
- *Let each section import `./actions` and bind what it needs* — rejected: bindings get duplicated across files, the "which action is bound to what" mapping stops being readable in one place, and a section could bind the same action differently by accident. The page is the single place where a server action meets a trip id.
- *Bundle all bound actions into one `actions` prop object* — deferred: it is the fallback if the page exceeds the budget, but it hides the call-site mapping behind an indirection. Start explicit; only group if measurement forces it.
- *Pass raw actions + ids and let sections bind* — rejected: same duplication problem, and it makes every section aware of trip-id plumbing.

**Rationale**: Keeping bindings in the page preserves today's exact prop values (the e2e suite asserts behavior that depends on them) and keeps the extraction mechanical: move JSX, pass the same expression.

### Decision: Cross-section derived values stay in the page (D3)

**Choice**: `totalCost`, `hasAnyCost`, `budgetDiff`, `completeness`, `dayOrder`, `tripDateRangeDays`, `isEditable`, `travelerHref`, `isPublished` are computed in the page and passed as props. `itemOrder` may be derived inside `DayCard` from its own `day` prop (it never crosses sections).

**Alternatives considered**:
- *Recompute aggregates inside the sections that display them* — rejected: `totalCost`/`hasAnyCost`/`budgetDiff` are consumed by the Finanzas card, `completeness` by the Completitud card, `dayOrder` by the day cards: recomputing multiplies the same reduce over the same data and invites drift.
- *Introduce a shared selector module* — rejected: over-engineering for a pure move; the values are already computed once in the page and there is no third consumer.

**Rationale**: One computation, one source, passed by prop. `itemOrder` is local to a single day card, so deriving it there removes a prop without creating a second source of truth.

### Decision: No new client components and no directive changes (D4)

**Choice**: The extraction introduces zero `"use client"` modules. Interactivity stays in the existing client children (`DayFormDialog`, `ItemFormDialog`, `TripClientsManager`, `TripTagsManager`, `ServiceChecklistManager`, `PackingListManager`, `DeleteTripDialog`, `MoveItemToDayDialog`, `DuplicateItemDialog`, `GenerateDaysButton`, `TripEditorShortcuts`, `UndoToastHost`, …).

**Alternatives considered**:
- *Convert a section to a client component for convenience* — rejected: this change is a pure refactor; changing a runtime boundary is a behavior/architecture change that belongs in its own change.
- *Move `TripEditorShortcuts` / `UndoToastHost` into a section* — rejected: they are page-level overlays tied to trigger ids and must stay at the composer level.

**Rationale**: `architecture.md:404-406` states the convention: Server Components by default, `"use client"` only where real interactivity is needed. All interactivity already lives in children.

### Decision: Trigger ids stay on exactly the same two buttons (D5)

**Choice**: `ADD_DAY_TRIGGER_ID` remains on the left-aside "+ Agregar día" button inside `DayFormDialog`'s trigger (`DaysNavSection`). `ADD_ITEM_LAST_DAY_TRIGGER_ID` remains on the last day's "+ Agregar item a este día" button (`DayCard`), gated by `isLastDay` exactly as today. The mobile add-day button keeps **no** id.

**Alternatives considered**:
- *Give the mobile add-day button the id too* — rejected: `document.getElementById` is used by the shortcuts layer; duplicating an id changes which element receives the programmatic click.
- *Move `TripEditorShortcuts` into `DaysNavSection`* — rejected: the shortcuts layer is page-scoped and also targets the last-day add-item trigger, which lives in a different section.

**Rationale**: The ids are a contract with `@/components/TripEditorShortcuts`; a pure refactor preserves the element that owns each id and the count of elements owning it.

### Decision: `statusMeta` and `countDaysInRange` move to `sections/trip-editor-meta.ts` (D6)

**Choice**: A new non-JSX module `src/app/dashboard/trips/[id]/sections/trip-editor-meta.ts` exports `statusMeta` and `countDaysInRange`. The page imports `countDaysInRange`; the page and `TripSidebarDetailsSection` (status history) import `statusMeta`, and `TripHeaderSection` imports it for the badge.

**Alternatives considered**:
- *Leave both in `page.tsx` and export them* — rejected: a `page.tsx` is a route module; exporting helpers from it invites circular imports from the sections that need them.
- *Put them in `src/lib/`* — rejected: they are page-presentation concerns (a class-string map and a date-range count for this editor), not domain data. `architecture.md` restricts `src/lib/data*` to data access.
- *Duplicate the map/count per section* — rejected: divergence risk and a second source of truth for status labels.

**Rationale**: A small co-located module keeps both helpers testable and importable by the page and the sections without turning the page module into a library.

### Decision: Structural pin test reads the page plus the section files (D7)

**Choice**: `__tests__/page.test.ts` keeps its seven assertions verbatim and changes only its read set: it reads `../page.tsx` and each `../sections/*.tsx` file and joins them before asserting.

**Alternatives considered**:
- *Delete or rewrite the assertions per file* — rejected: that would replace the existing pin with a new, weaker one; the task is to preserve the assertion set, not to re-author it.
- *Keep the test reading only `page.tsx` and leave placeholder markup behind* — rejected: it would mean moving markup only partially, defeating the refactor.
- *Add per-file provenance assertions (which file holds which string)* — rejected for this PR: it grows the assertion set beyond preservation. The joined read keeps the same guarantees the test had (the strings exist in the trip-editor surface).

**Rationale**: The test is a text-level structural pin, not a behavior test. Widening the read set preserves exactly the same signal — "these corporate class strings and component names still appear in the trip editor" — while surviving the move. Behavior is covered by the local e2e suite.

### Decision: Single PR with a documented >400-line exception (D8)

**Choice**: Ship as one PR; document the size exception here and in `proposal.md` per `architecture.md:427-428`.

**Alternatives considered**:
- *Split into chained PRs (one per section)* — rejected: the pin test and the page's DOM order are only consistent at the end state; each intermediate PR would leave a half-updated test or a half-migrated page, and the reviewer would have to review the same mechanical move in several contexts. The real review need here is a side-by-side of moved blocks, which is exactly what one diff provides.
- *Shrink the diff artificially (e.g. reformat while moving)* — rejected: it hides the move and makes the byte-level comparison harder.

**Rationale**: A pure move is large in diff lines and small in risk; the exception is documented rather than dodged. Work-unit commits (pin → meta → header → days nav → center → sidebars → verification) keep each commit bounded.

### Decision: File-size budget ~300 lines (D9)

**Choice**: `page.tsx` and every new section file must be under ~300 lines, measured with `wc -l` in verification.

**Alternatives considered**:
- *No budget* — rejected: the issue's whole point is to cap file size.
- *Hard CI gate* — rejected: out of scope; a measurement task in the verification phase is enough.

**Rationale**: The issue requires no file to exceed ~300 lines. Expected sizes: `page.tsx` ~230–290, `DayCard.tsx` ~230–280, `ItinerarySection.tsx` ~90–130, `TripSidebarActionsSection.tsx` ~160–200, `TripSidebarDetailsSection.tsx` ~180–220, `TripHeaderSection.tsx` ~70, `DaysNavSection.tsx` ~65, `trip-editor-meta.ts` ~20.

## Data Flow

### Before

```
src/app/dashboard/trips/[id]/page.tsx  (870 lines, async Server Component, no state)
   ├─ module: documentsEnabled / photosEnabled / coversEnabled  (:50-53)
   ├─ module: statusMeta (:44-48), countDaysInRange (:862-870)
   ├─ await params → trip, clients, tags, internalNotes, allSuppliers,
   │                travelAgents, serviceDocumentSummaries   (Promise.all :134-155)
   ├─ getTripFeedback (await, :143) + getDailyWeather per day (await, :161)
   ├─ derived: dayOrder, tripDateRangeDays, completeness, totalCost,
   │           hasAnyCost, budgetDiff, isPublished, isEditable, travelerHref
   └─ JSX: back link → header/publish → published banner → grid
          [ aside days nav | section itinerary (day cards + items) | aside rail ]
          → TripEditorShortcuts + UndoToastHost
```

### After

```
src/app/dashboard/trips/[id]/sections/trip-editor-meta.ts
   ├─ statusMeta
   └─ countDaysInRange

src/app/dashboard/trips/[id]/page.tsx  (composer, < ~300 lines, async Server Component)
   ├─ module: documentsEnabled / photosEnabled / coversEnabled
   ├─ data loading + getTripFeedback + getDailyWeather   (unchanged)
   ├─ derived aggregates (unchanged) + all action.bind(...) expressions
   └─ JSX: <main>
            ├─ back link (kept inline: one line of route chrome)
            ├─ <TripHeaderSection trip travelerHref onTogglePublish={publishTripStatusAction.bind(...)} />
            ├─ grid
            │   ├─ <DaysNavSection trip isEditable tripDateRangeDays
            │   │       onAddDay={addDayAction.bind(null, trip.id)}
            │   │       onGenerateDays={generateTripDaysAction.bind(null, trip.id)} />
            │   ├─ <ItinerarySection trip dayOrder dayWeather isEditable
            │   │       allSuppliers documentsEnabled tripDateRangeDays + day/item actions />
            │   │        └─ trip.days.map(day => <DayCard key={day.id} day dayIndex dayOrder
            │   │                                  weather isEditable … bound actions />)
            │   └─ <TripSidebarActionsSection trip isEditable clients tags travelAgents
            │   │       internalNotes totalCost hasAnyCost budgetDiff completeness + actions />
            │       <TripSidebarDetailsSection trip isEditable clientNameById
            │           serviceDocumentSummaries documentsEnabled photosEnabled coversEnabled
            │           feedback + actions />
            └─ <TripEditorShortcuts /> + <UndoToastHost />
```

### Trigger-id contract (unchanged)

```
TripEditorShortcuts (client)
   ├─ document.getElementById(ADD_DAY_TRIGGER_ID)
   │     └─ DaysNavSection → DayFormDialog trigger button  (left aside only)
   └─ document.getElementById(ADD_ITEM_LAST_DAY_TRIGGER_ID)
         └─ DayCard → ItemFormDialog trigger button, rendered only when isLastDay
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/dashboard/trips/[id]/page.tsx` | Modify | Composer: env flags, data loading, derived aggregates, all `action.bind(...)`, section composition, shortcuts + undo host. Under ~300 lines. |
| `src/app/dashboard/trips/[id]/sections/trip-editor-meta.ts` | Create | `statusMeta` (`:44-48`) and `countDaysInRange` (`:862-870`) moved verbatim. |
| `src/app/dashboard/trips/[id]/sections/TripHeaderSection.tsx` | Create | Header/publish block (`:168-221`) + published-lock banner (`:223-227`). |
| `src/app/dashboard/trips/[id]/sections/DaysNavSection.tsx` | Create | Left aside (`:231-283`): day anchors, add-day dialog with `ADD_DAY_TRIGGER_ID`, `GenerateDaysButton`. |
| `src/app/dashboard/trips/[id]/sections/ItinerarySection.tsx` | Create | Center shell (`:285-~330`, `~588-590`): itinerary header card, day list loop, mobile add-day row. |
| `src/app/dashboard/trips/[id]/sections/DayCard.tsx` | Create | One day card (`:~332-586`): header, reorder/edit, notes, item rows, empty state, add-item dialog with `ADD_ITEM_LAST_DAY_TRIGGER_ID` on the last day. |
| `src/app/dashboard/trips/[id]/sections/TripSidebarActionsSection.tsx` | Create | Acciones (incl. published-lock copy, `:592-~708`), Finanzas (`~710-745`), Completitud (`~747-772`). |
| `src/app/dashboard/trips/[id]/sections/TripSidebarDetailsSection.tsx` | Create | Cover, photos, documents, `ServiceChecklistManager`, status history, feedback, packing, danger zone (`~774-850`). |
| `src/app/dashboard/trips/[id]/__tests__/page.test.ts` | Modify | Same seven assertions; read set widened to `page.tsx` + `sections/*.tsx`. |
| `src/app/dashboard/trips/[id]/actions.ts` | Verify | No edit: no action, signature, or binding changes. |
| `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` | Verify | No edit: does not read page JSX. |
| `architecture.md` | Modify/Verify | Add `trips/[id]/sections/` to the folder listing if that listing ages; otherwise leave untouched and record the decision. |
| `README.md` | Verify | Confirm the truth-source table needs no edit (technical → `architecture.md`). |

## Interfaces / Contracts

### `sections/trip-editor-meta.ts`

```ts
export const statusMeta: Record<
  "draft" | "published" | "archived",
  { label: string; color: string }
>;

/** Inclusive day count for a trip date range; null when the range is invalid. */
export function countDaysInRange(startDate: string, endDate: string): number | null;
```

Contract: byte-identical values to today's page-level map and helper; no framing, no defaults added.

### `sections/TripHeaderSection.tsx` (Server Component)

```tsx
export function TripHeaderSection({
  trip,
  travelerHref,
  onTogglePublish,
}: {
  trip: Trip;
  travelerHref: string;
  onTogglePublish: (formData: FormData) => void | Promise<void>; // publishTripStatusAction.bind(null, trip.id, target)
}): React.ReactNode;
```

Contract: renders the same header, status badge (`statusMeta[trip.status]`), assigned clients/traveler count line, date range, tag list, publish form (`TripPublishSubmitButton`), preview and quote links, `CopyUrlButtonClient` + `ShareWhatsAppButton` when published, and the published-lock banner. Classes, copy, and order unchanged.

### `sections/DaysNavSection.tsx` (Server Component)

```tsx
export function DaysNavSection({
  trip,
  isEditable,
  tripDateRangeDays,
  onAddDay,
  onGenerateDays,
}: {
  trip: Trip;
  isEditable: boolean;
  tripDateRangeDays: number | null;
  onAddDay: (formData: FormData) => void | Promise<void>;
  onGenerateDays: (formData: FormData) => void | Promise<void>;
}): React.ReactNode;
```

Contract: same sticky day-nav card, same anchors (`#day-${day.id}`), same per-day item counter classes, and the add-day dialog whose trigger button carries `id={ADD_DAY_TRIGGER_ID}`; `GenerateDaysButton` rendered only when `tripDateRangeDays !== null`.

### `sections/ItinerarySection.tsx` (Server Component)

```tsx
export function ItinerarySection({
  trip,
  isEditable,
  dayOrder,
  dayWeather,
  tripDateRangeDays,
  allSuppliers,
  documentsEnabled,
  actions,
}: {
  trip: Trip;
  isEditable: boolean;
  dayOrder: { id: string; sortOrder: number }[];
  dayWeather: Awaited<ReturnType<typeof getDailyWeather>>[];
  tripDateRangeDays: number | null;
  allSuppliers: Supplier[];
  documentsEnabled: boolean;
  actions: ItineraryActions; // bound day/item actions, grouped only if needed for budget
}): React.ReactNode;
```

Contract: renders the "Itinerario por días" card and the "Ir al último día" link (only when `trip.days.length > 0`), then one `DayCard` per day keyed by `day.id`, then the mobile add-day row gated by `isEditable`. The `actions` prop is optional grouping; if the explicit-prop form keeps `page.tsx` under budget it SHOULD be used instead (see D2).

### `sections/DayCard.tsx` (Server Component)

```tsx
export function DayCard({
  trip,
  day,
  dayIndex,
  isLastDay,
  weather,
  isEditable,
  allSuppliers,
  documentsEnabled,
  actions, // bound moveDay/editDay/deleteDay/restoreDay/addItem/editItem/deleteItem/restoreItem/moveItemToDay/duplicateItem/getItemDocuments/uploadDocument/deleteDocument
}: { … }): React.ReactNode;
```

Contract: same day card wrapper (`id={`day-${day.id}`}`, same classes), same "Día n" label, `WeatherBadge`, same reorder/edit controls gated by `isEditable`, same day-notes block, same per-item row (icon, title, time + tz, flight badge, location, cost, confirmation, metadata summary, `LocationActions`), same empty-day message text, and the add-item `ItemFormDialog` bearing `id={isLastDay ? ADD_ITEM_LAST_DAY_TRIGGER_ID : undefined}`. `itemOrder` is derived locally from `day.items`; `dayIndex`/`isLastDay` come from the page's `dayOrder`.

### `sections/TripSidebarActionsSection.tsx` (Server Component)

```tsx
export function TripSidebarActionsSection({
  trip,
  isEditable,
  clients,
  tags,
  travelAgents,
  internalNotes,
  hasAnyCost,
  totalCost,
  budgetDiff,
  completeness,
  actions,
}: { … }): React.ReactNode;
```

Contract: renders the Acciones card (edit controls when `isEditable`, otherwise the exact copy `"Las acciones de edición están bloqueadas mientras el viaje está publicado."`), the Finanzas card (`totalCost`, `trip.budget`, `budgetDiff` used/over-budget branches, "Sin costos registrados."), and the Completitud card (`completeness.documentPercentage`, progress bar width, `itemsWithDocuments de totalItems`, empty-days message).

### `sections/TripSidebarDetailsSection.tsx` (Server Component)

```tsx
export function TripSidebarDetailsSection({
  trip,
  isEditable,
  clientNameById,
  serviceDocumentSummaries,
  feedback,
  documentsEnabled,
  photosEnabled,
  coversEnabled,
  actions,
}: { … }): React.ReactNode;
```

Contract: renders `TripCoverImage`, `TripPhotoGallery`, `TripDocuments` (each gated by `isEditable`), `ServiceChecklistManager` with its bound actions and `isArchived={trip.status === "archived"}`, the status-history card (only when `trip.statusHistory.length > 0`, `statusMeta` labels, last 3 reversed), the feedback card (only when `feedback.length > 0`), `PackingListManager` when editable, and the danger zone with `DeleteTripDialog`.

### `page.tsx` (Server Component)

Public surface unchanged: default export `async function TripEditorPage({ params })`. It keeps `notFound()` behavior, the `Promise.all` data loading, the post-`notFound` `getTripFeedback` await, the per-day `getDailyWeather` await, all derived aggregates, and all `action.bind(...)` expressions. Only the JSX is delegated.

## Testing Strategy

`strict_tdd: true`: the changed artifact with a deterministic expected outcome is the structural pin test, so it is updated before the extraction.

| Step | What runs | Expected result |
|------|-----------|-----------------|
| RED | `npm run test -- page` after `page.test.ts` reads `../sections/*.tsx` (files absent) | Fails: `readFileSync` cannot find the section files. The assertion set is already the final one. |
| GREEN | Extract the sections and the meta module; `npm run test -- page` | The pin test passes with the same seven assertions. |
| TRIANGULATE | `npm run test` (full unit suite) + `wc -l` on the eight files | `actions.test.ts`, `ServiceChecklistManager.test.tsx` and the rest of the suite unchanged and green; every file under ~300 lines. |
| REFACTOR | Re-read the final diff for byte-level equivalence of moved blocks; re-run `npm run test` | No copy/class/order drift; suite green. |

| Layer | What verifies | Approach |
|-------|---------------|----------|
| Unit (structural) | The trip editor still carries the corporate class strings and critical component names | `__tests__/page.test.ts` (updated read set, same assertions) |
| Unit | Server Actions and the checklist manager are untouched | existing `actions.test.ts`, `ServiceChecklistManager.test.tsx` |
| E2E (local) | Publish toggle, day/item CRUD, documents, checklist, traveler activities, visibility links | `e2e/local/dashboard.spec.ts`, `service-documents.spec.ts`, `traveler-activities.spec.ts`, `trip-visibility.spec.ts` (plus the rest of the local project) |
| Type/build | Section props, bound-action shapes, no directive regressions | `npx tsc --noEmit`, `npm run build` |
| Size | Every resulting file under budget | `wc -l` over `page.tsx` + `sections/*` |

## Threat Matrix

N/A — this change introduces no shell/CLI routing, subprocess execution, VCS/PR automation, executable classification, or process-integration edge. It is a static JSX move inside one App Router route, with no inputs, network calls, or new execution surface. No matrix row applies and no RED tests are fabricated from it.

## Migration / Rollout

- **Data/schema**: no migrations. Nothing under `supabase/migrations/` or `supabase/seed.sql` changes.
- **Rollout**: single PR; the effect is internal only. No feature flag needed because behavior is unchanged.
- **Compatibility**: the route URL, the page's public signature, all client-dialog props, all trigger ids, and all Server Action bindings are preserved. `src/lib/data*` and `actions.ts` are untouched.
- **Rollback**: revert the commits; delete `sections/`; `page.test.ts` returns to reading only `page.tsx`.
- **Docs**: `architecture.md` is the technical source of truth; update the `trips/[id]/` folder listing if it ages (adding `trips/[id]/sections/`), and verify the `README.md` truth-source table in the same PR.

## Open Questions

- [ ] Should the section props be explicit per action, or grouped into a per-section `actions` object? Proposed: explicit while `page.tsx` stays under ~300 lines; fall back to a grouped object (or a second split of the rail) only if measurement forces it.
- [ ] Should `ItinerarySection` own the `trip.days.map(...)` loop (passing `dayIndex`/`isLastDay`) or should the page map days and render `DayCard` directly? Proposed: `ItinerarySection` owns the loop so the mobile add-day row and the last-day index stay together; the page keeps `dayOrder` and `dayWeather`.
- [ ] Should `feedback` be passed as a prop or re-fetched in `TripSidebarDetailsSection`? Proposed: passed as a prop — the page already awaits it after `notFound()`, and re-fetching would add a second data read on the same request.

# Tasks: Travel Agents Catalog and Trip Assignment

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–800 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Suggested split | Single PR (session budget 800 covers it) |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + types + data layer (catalog CRUD, trip assignment, filters) | PR 1 | `npx vitest run src/lib/__tests__/data.test.ts` | N/A — mock-mode Vitest, no runtime server needed | Revert `travel-agents.ts`, `trips.ts`, `trip-filters.ts`, `mock-data.ts`, types, migration |
| 2 | UI wiring (catalog page, combobox, filters, trip create/edit, explorer) | PR 1 | `npm run build && npm run test` | `npm run dev` → `/dashboard/travel-agents`, `/dashboard/trips` | Revert all `src/app/dashboard/**`, `TravelAgentCombobox.tsx`, `NewTripForm.tsx`, `TripsExplorer.tsx` |

## Phase 1: Schema, Types & Mock Foundation

- [x] 1.1 **RED** — `src/lib/__tests__/data.test.ts`: add `describe('travel-agents')` with failing tests for `getTravelAgents` (empty → []), `createTravelAgent` (name required), `getTravelAgentById`.
- [x] 1.2 Create `supabase/migrations/0041_travel_agents.sql`: `travel_agents` table (id uuid, name text not null, email?, phone?, notes?, timestamps), `lower(name)` unique index, `trips.assigned_agent_id` FK → `travel_agents(id) ON DELETE SET NULL` + index, RLS owner-only.
- [x] 1.3 Add `TravelAgent` interface, `Trip.assignedAgentId?`, `TripFilters.agentIds?` to `src/types/index.ts`.
- [x] 1.4 Add `mockTravelAgents: TravelAgent[]` and `assignedAgentId` fields to `mockTrips` in `src/lib/mock-data.ts`.

## Phase 2: Data Layer — Travel Agents

- [x] 2.1 **GREEN** — Create `src/lib/data/travel-agents.ts`: `rowToTravelAgent`, `getTravelAgents`, `getTravelAgentById`, `createTravelAgent`, `updateTravelAgent`, `deleteTravelAgent` (mock branch + Supabase branch). Re-export from `src/lib/data.ts`.
- [x] 2.2 **RED** — `data.test.ts`: add tests for `updateTravelAgent`, `deleteTravelAgent` (no trips → removed), `deleteTravelAgent` (referenced trips → `assignedAgentId` becomes null, silent SET NULL).
- [x] 2.3 **GREEN** — Implement `deleteTravelAgent` Supabase branch with silent delete (FK handles nullification). Verify tests pass.
- [x] 2.4 **REFACTOR** — Extract shared validation (name required, unique case-insensitive) into helpers if duplicated.

## Phase 3: Data Layer — Trip Assignment & Filters

- [x] 3.1 **RED** — `data.test.ts`: add tests for `createTrip({assignedAgentId})`, `updateTrip` changing agent, agent filter in `getTripsWithClients` (single agent, multi agent, zero matches).
- [x] 3.2 **GREEN** — Update `src/lib/data/trips.ts`: `rowToTrip` maps `assigned_agent_id`; `createTrip`/`updateTrip` accept `assignedAgentId`; `getSupabaseTripIdsForFilters` handles `agentIds` via `in("assigned_agent_id", …)`.
- [x] 3.3 **GREEN** — Update `src/lib/trip-filters.ts`: add `agentIds` to `hasActiveTripFilters`, `tripMatchesFilters` (match `assignedAgentId` against `agentIds`), `TripFilterListItem`.
- [x] 3.4 **REFACTOR** — Verify `npx tsc --noEmit` and `npm run test` pass cleanly.

## Phase 4: UI — Catalog Page

- [x] 4.1 Create `src/app/dashboard/travel-agents/actions.ts`: server actions `createTravelAgentAction`, `updateTravelAgentAction`, `deleteTravelAgentAction` (redelegate to data layer).
- [x] 4.2 Create `src/app/dashboard/travel-agents/catalog-client.tsx`: client component with list/create/edit/delete UI (mirror `suppliers/*` patterns).
- [x] 4.3 Create `src/app/dashboard/travel-agents/page.tsx`: server component fetching `getTravelAgents()` and rendering catalog-client.
- [x] 4.4 Add "Travel Agents" nav link to `src/app/dashboard/layout.tsx`.

## Phase 5: UI — Trip Assignment & Filters

- [x] 5.1 Create `src/components/TravelAgentCombobox.tsx`: single-select combobox (mirror `SupplierCombobox`), accepts `travelAgents[]` and `value`/`onChange`.
- [x] 5.2 Modify `src/components/NewTripForm.tsx` + `src/app/dashboard/trips/new/actions.ts`: add optional `TravelAgentCombobox`; pass `assignedAgentId` to `createTrip`.
- [x] 5.3 Modify `src/app/dashboard/trips/[id]/page.tsx` + `actions.ts`: render current agent, allow change/clear via `updateTrip`.
- [x] 5.4 Modify `src/app/dashboard/trips/page.tsx`: fetch `getTravelAgents()`, parse `agent` URL param → `filters.agentIds`.
- [x] 5.5 Modify `src/app/dashboard/DashboardFilters.tsx`: add agent multi-combobox, active badge, URL sync (`?agent=…`).
- [x] 5.6 Modify `src/app/dashboard/trips/TripsExplorer.tsx`: resolve agent label from `travelAgents[]` by id; render in list/board items.

## Phase 6: Security & Verification Tests

- [x] 6.1 **RED** — `src/lib/__tests__/public-trip-details.test.ts`: add test asserting `travel_agents` table is never queried on public `/t/[slug]` path.
- [x] 6.2 **GREEN** — Verify public trip data functions do not import or query `travel_agents`; test passes.
- [x] 6.3 Run full gates: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`. Fix any failures.

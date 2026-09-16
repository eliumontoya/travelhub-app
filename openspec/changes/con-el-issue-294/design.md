# Design: Travel Agents Catalog and Trip Assignment

## Technical Approach

Add a `travel_agents` catalog plus a single optional `trips.assigned_agent_id` nullable FK, mirroring existing dual-mode patterns. Catalog CRUD follows `tags` (name-keyed) + `suppliers` (dedicated module/page/combobox); singular assignment follows `items.supplier_id`. A "By travel agents" multi-select filter joins the `TripFilters` pipeline (mock branch in `trip-filters.ts`, Supabase branch in `getSupabaseTripIdsForFilters`). No restriction rules: RLS stays owner-only.

## Architecture Decisions

### Decision: Nullable FK, not M2M junction

| Option | Tradeoff | Decision |
|--------|----------|----------|
| Nullable `trips.assigned_agent_id` | Minimal; singular; simple `in()`/`eq()` | ✅ Chosen |
| `trip_travel_agents` junction | Multi-agent future-proof; over-engineered; complex intersection | Rejected |

**Rationale**: Issue asks for one agent per trip, no restriction rules. `0029_suppliers.sql` models this exact shape; `ON DELETE SET NULL` preserves trips when an agent is removed. A junction adds table/UI/filter complexity with no current need.

### Decision: Catalog shape = tags + suppliers

**Choice**: `travel_agents` = `id`, `name` (required, unique case-insensitive), `email?`, `phone?`, `notes?`, timestamps. CRUD in a dedicated module + `/dashboard/travel-agents` page + `TravelAgentCombobox`, copying `suppliers/*`.
**Rationale**: A name-keyed lookup like `tags`, but with contact fields and an editable catalog like `suppliers`. Copying the suppliers module/page/combobox gives list/create/edit/delete with least invention.

### Decision: Dedicated `travel-agents.ts` module

**Choice**: New `src/lib/data/travel-agents.ts` (re-exported from `data.ts`), not functions in `trips.ts`.
**Rationale**: Anti-monolith rule maps `rowTo*`/catalog functions to the owning domain; `suppliers.ts` is the precedent. `trips.ts` only gains `assigned_agent_id` in `rowToTrip`/`createTrip`/`updateTrip`/filters.

### Decision: No join in `loadTripRelations`

**Choice**: `rowToTrip` maps `assigned_agent_id` → `assignedAgentId` (id only). Pages already fetch the full agent catalog; `TripsExplorer` resolves the label by id.
**Rationale**: A single nullable FK needs no batched junction hydration; avoids an extra query and keeps parity trivial.

### Decision: Dual-mode parity + RLS owner-only

**Choice**: Mirror every `travel_agents` change in `mock-data.ts` and mock branches. RLS: `enable`+`force`, `for all` policy `auth.uid() is not null`, `revoke from anon`, grant CRUD to `authenticated`; `trips` RLS unchanged.
**Rationale**: `isSupabaseConfigured()` gates all access — without parity local dev breaks. `auth.uid() is not null` is single-owner auth, matching `tags_owner_all`.

### Decision: `assigned_agent_id` out of public view

**Choice**: Add `assignedAgentId?` to `Trip`/`rowToTrip` (dashboard needs it) but never render it on `/t/[slug]` and never query `travel_agents` there. Extend `public-trip-details.test.ts` to assert `travel_agents` is not queried.
**Rationale**: Matches `salePrice`/`commissionRate` convention — present on `Trip` for the agent UI, never selected/rendered for travelers. `travel_agents` RLS (no `anon` grant) is the hard boundary.

## Data Flow

```
DashboardFilters → router.replace("?agent=…")
trips/page.tsx: parse "agent" → filters.agentIds; getTravelAgents()
getTripsWithClients({filters})
   ├─ mock: tripMatchesFilters (agentIds vs assignedAgentId)
   └─ supabase: getSupabaseTripIdsForFilters → trips.in("assigned_agent_id", agentIds)
TripsExplorer: travelAgents.find(id) → render name
create/edit: TravelAgentCombobox → createTrip/updateTrip({assignedAgentId})
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/0041_travel_agents.sql` | Create | `travel_agents` table, `lower(name)` unique index, `trips.assigned_agent_id` FK + index, RLS |
| `src/types/index.ts` | Modify | `TravelAgent`; `Trip.assignedAgentId?`; `TripFilters.agentIds?` |
| `src/lib/data/travel-agents.ts` | Create | `getTravelAgents`, `getTravelAgentById`, `createTravelAgent`, `updateTravelAgent`, `deleteTravelAgent`, `rowToTravelAgent` |
| `src/lib/data.ts` | Modify | Re-export `travel-agents` |
| `src/lib/data/trips.ts` | Modify | `assigned_agent_id` in `rowToTrip`/`createTrip`/`updateTrip`/`getSupabaseTripIdsForFilters` |
| `src/lib/trip-filters.ts` | Modify | `agentIds` in `hasActiveTripFilters`, `tripMatchesFilters`, `TripFilterListItem` |
| `src/lib/mock-data.ts` | Modify | `mockTravelAgents`; `assignedAgentId` on `mockTrips` |
| `src/app/dashboard/travel-agents/{page,catalog-client,actions}.{tsx,ts}` | Create | Catalog page + CRUD (mirror `suppliers/*`) |
| `src/app/dashboard/layout.tsx` | Modify | Nav link |
| `src/components/TravelAgentCombobox.tsx` | Create | Single-select combobox (mirror `SupplierCombobox`) |
| `src/components/NewTripForm.tsx`, `trips/new/actions.ts` | Modify | Optional assigned-agent select |
| `src/app/dashboard/trips/[id]/page.tsx`, `actions.ts` | Modify | Render/change assigned agent |
| `src/app/dashboard/trips/page.tsx` | Modify | Fetch agents; parse `agent` param |
| `src/app/dashboard/DashboardFilters.tsx` | Modify | Agent multi-combobox + badge + URL sync |
| `src/app/dashboard/trips/TripsExplorer.tsx` | Modify | Render agent label; pass `travelAgents` |
| `src/lib/__tests__/data.test.ts` | Modify | Catalog CRUD + agent filter tests |
| `src/lib/__tests__/public-trip-details.test.ts` | Modify | Assert `travel_agents` not queried publicly |

## Interfaces / Contracts

```ts
export interface TravelAgent {
  id: string; name: string;
  email?: string; phone?: string; notes?: string;
  createdAt: string; updatedAt: string;
}
// Trip:        assignedAgentId?: string;
// TripFilters: agentIds?: string[];
```

`CreateTripInput` / `UpdateTripInput` gain `assignedAgentId?: string | null`.

## Testing Strategy

| Layer | What | Approach |
|-------|------|----------|
| Unit (mock) | Catalog CRUD | Vitest, mirror supplier tests in `data.test.ts` |
| Unit (mock) | Agent filter (`getTripsWithClients`, `tripMatchesFilters`) | Extend existing filter describes |
| Integration | `createTrip`/`updateTrip` persist `assignedAgentId` | Extend `data.test.ts` |
| Security | Public path never queries `travel_agents` | Extend `public-trip-details.test.ts` |

## Threat Matrix

`N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.`

## Migration / Rollout

Additive, reversible. `0041` uses `if not exists`/`add column if not exists`. Rollback: drop `trips.assigned_agent_id`, then `travel_agents`; revert TS/UI in reverse. No backfill — FK is nullable; existing trips stay unassigned.

## Open Questions

- [x] Deleting an agent that trips reference: **resolved — silent `ON DELETE SET NULL`** (user decision 2026-09-16). Trips become unassigned automatically; no warning and no reference-count guard.

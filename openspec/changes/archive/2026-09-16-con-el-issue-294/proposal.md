# Proposal: Travel Agents Catalog and Trip Assignment

## Intent

Add a "travel agents" catalog and let each trip carry a single, optional "assigned agent", so the travel agent can track who is responsible for a trip and filter the trips list by agent. There are no restriction rules: every agent can see all trips.

## Scope

### In Scope

- New `travel_agents` catalog (list/create/edit/delete) mirroring the `tags`/`suppliers` catalog patterns.
- New nullable `trips.assigned_agent_id` FK to `travel_agents` (singular assignment).
- Assign/change agent during trip creation and editing.
- "By travel agents" filter on `/dashboard/trips`.
- Render assigned agent in trip list/board items.
- Dual-mode parity: Supabase migration + mock data, tests.

### Out of Scope

- Many-to-many trip↔agent assignment (junction table).
- Restriction/permission rules between agents.
- Exposing the assigned agent on the public `/t/{slug}` view.
- Agent login/multi-user accounts (catalog only).

## Capabilities

### New Capabilities

- `travel-agent-catalog`: CRUD for travel agent records and the nullable assignment of a single agent to a trip.

### Modified Capabilities

- `trip-itinerary`: Trip gains an `assigned_agent_id` attribute; assign/change agent during creation and editing.
- `dashboard-workspace`: Trip explorer gains a "By travel agents" filter.

## Approach

Use Approach 1 from exploration: nullable `trips.assigned_agent_id` FK to a new `travel_agents` table, mirroring the `suppliers`/`items` pattern (and `tags` for catalog CRUD). New migration with RLS owner-only policies; data-layer functions `getTravelAgents`/`rowToTravelAgent`; mock parity in `mock-data.ts` and `src/lib/trip-filters.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `supabase/migrations/` | New | `travel_agents` table, `trips.assigned_agent_id` FK, index, RLS |
| `src/types/index.ts` | Modified | `TravelAgent` type, `Trip.assignedAgentId`, `TripFilters.agentIds` |
| `src/lib/mock-data.ts` | Modified | `mockTravelAgents`, `assignedAgentId` on `mockTrips` |
| `src/lib/data/trips.ts` | Modified | `getTravelAgents`, `rowToTravelAgent`, filter/hydration, create/update |
| `src/lib/data.ts` | Modified | Re-export new functions |
| `src/lib/trip-filters.ts` | Modified | `agentIds` matching (mock mode) |
| `src/app/dashboard/trips/**` | Modified | Fetch agents, `agent` URL param, list/board rendering, create/edit assignment |
| `src/app/dashboard/DashboardFilters.tsx` | Modified | Agent combobox + active badge |
| `src/lib/__tests__/data.test.ts` | Modified | Catalog + agent filter tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| "Agent" term collision (travel agent vs AI WhatsApp agent) | Med | Use `travel_agent`, `TravelAgent`, `assignedAgentId` consistently |
| Public exposure of internal assignment | Med | Keep `assigned_agent_id` out of public selects/types |
| Mock/Supabase parity drift | Med | Mirror schema + functions in `mock-data.ts`; add tests |
| RLS over-scoping | Low | Keep owner-only policy; no per-agent row isolation |
| Existing trips have no agent | High | FK nullable; UI handles unassigned trips |

## Rollback Plan

The migration is additive and reversible: drop `trips.assigned_agent_id` (or drop the column and `travel_agents` table) to revert schema. Remove the TS types, data functions, and UI wiring in reverse order. No destructive data change; unassigned trips remain valid throughout.

## Dependencies

- None external. Follows existing `suppliers`/`tags` patterns.

## Success Criteria

- [ ] Agent can create, list, edit, and delete travel agents.
- [ ] A trip can be created/edited with one optional assigned agent; unassigned trips remain valid.
- [ ] `/dashboard/trips` filters trips by one or more agents (URL param + UI badge).
- [ ] Assigned agent renders in trip list/board items.
- [ ] Mock and Supabase modes behave identically; `npx tsc --noEmit`, `npm run test`, and `npm run build` pass.

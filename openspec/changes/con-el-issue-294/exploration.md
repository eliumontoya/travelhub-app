## Exploration: Travel agents catalog and trip assignment (issue #294)

### Current State

TravelHub is a mono-user Next.js App Router app. The authenticated `/dashboard/**` area uses Server Components + Server Actions that call `@/lib/data`, which is a facade over domain modules in `src/lib/data/*`. Data access is dual-mode: Supabase/Postgres when configured, in-memory mock data otherwise.

Trips are modeled in `src/types/index.ts` (`Trip` interface) and persisted in the `trips` table (`supabase/migrations/0001_init.sql`). Relevant trip columns today: `id`, `client_id`, `title`, `slug`, `start_date`, `end_date`, `cover_image_url`, `instructions`, `status`, `currency`, `is_template`, `traveler_count`, `budget`, `show_costs_to_client`, `sale_price`, `commission_rate`, `internal_notes`, `reminder_sent_at`, `created_at`, `updated_at`. There is no existing travel-agent catalog and no ownership/assignment attribute on trips.

The trips list lives at `/dashboard/trips/page.tsx`. It fetches `getTripsWithClients({ filters, page })`, all clients, and all tags. Filters are driven by `TripFilters` (`src/types/index.ts`) and rendered by `DashboardFilters` (`src/app/dashboard/DashboardFilters.tsx`). Existing filters: text query, status multi-checkbox, date range, client single-select, tags multi-select, currency select. URL params (`q`, `status`, `dateFrom`, `dateTo`, `client`, `tags`, `currency`, `page`) are parsed in the page. Filtering logic is split: `src/lib/trip-filters.ts` handles mock-mode client-side filtering; `src/lib/data/trips.ts` (`getSupabaseTripIdsForFilters`) handles Supabase-mode server-side filtering.

The closest existing catalog pattern is `tags` (`supabase/migrations/0007_trip_tags.sql`):

- `tags` table (`id uuid`, `name text`, `created_at timestamptz`).
- Junction tables `trip_tags` and `client_tags` for many-to-many assignment.
- RLS: `enable row level security`, owner-only policy (`auth.uid() is not null`), explicit `revoke`/`grant` to `authenticated`.
- TypeScript type `Tag` in `src/types/index.ts`.
- Data functions: `getTags`, `getOrCreateTag`, `rowToTag` in `src/lib/data/clients.ts`; `setTripTags` in `src/lib/data/trips.ts`.
- UI: `TripTagsManager` + `TagMultiCombobox` for assignment.

A simpler catalog+FK pattern also exists with `suppliers` (`supabase/migrations/0029_suppliers.sql`): a `suppliers` table plus a nullable `supplier_id` FK on `items`. This is a better analog for a single assigned agent per trip.

Tests for the data layer live in `src/lib/__tests__/data.test.ts` (Vitest, mock mode). They already cover trips, clients, tags, and suppliers.

### Affected Areas

- `src/types/index.ts` — add `TravelAgent` type, add `assignedAgentId` to `Trip`, add `agentIds` to `TripFilters`.
- `supabase/migrations/` — new migration: `travel_agents` table, `trips.assigned_agent_id` nullable FK, index, RLS policies.
- `src/lib/mock-data.ts` — add `mockTravelAgents` array and `assignedAgentId` to `mockTrips`.
- `src/lib/data/trips.ts` — add `getTravelAgents`, `rowToTravelAgent`, include `assigned_agent_id` in `rowToTrip`/`createTrip`/`updateTrip`, extend `getTripsWithClients` filter logic and hydration for agents.
- `src/lib/data.ts` — re-export new functions if placed in `trips.ts` (current facade pattern).
- `src/lib/trip-filters.ts` — add `agentIds` matching logic for mock mode.
- `src/app/dashboard/trips/page.tsx` — fetch agents, parse `agent` URL param, pass agents and filter state to `TripsExplorer`.
- `src/app/dashboard/DashboardFilters.tsx` — add agent multi-select/combobox, sync `agent` URL param, add active badge.
- `src/app/dashboard/trips/TripsExplorer.tsx` — render assigned agent in list/board items.
- `src/app/dashboard/trips/new/page.tsx` and `actions.ts` — allow selecting an assigned agent during trip creation.
- `src/app/dashboard/trips/[id]/page.tsx` and `actions.ts` — add an action + UI to change a trip's assigned agent.
- `src/lib/__tests__/data.test.ts` — add tests for travel-agent catalog and agent filtering.

### Approaches

1. **Nullable FK on trips (recommended)** — Create a `travel_agents` catalog table and add `trips.assigned_agent_id` as a nullable FK. Mirror the `suppliers`/`items` pattern.
   - Pros: Matches the requirement "each trip has one assigned agent" (singular), simplest data model, simplest filter (`eq`/`in` on `assigned_agent_id`), smallest change surface, easy to evolve later if requirements change.
   - Cons: If future requirements need many-to-many trip↔agent assignment, a refactor is required.
   - Effort: Low-Medium

2. **Many-to-many junction table** — Create `travel_agents` + `trip_travel_agents` junction, mirroring the `tags` pattern.
   - Pros: Future-proof for multiple agents per trip; consistent with existing tag-filter implementation.
   - Cons: Over-engineered for the current singular assignment requirement; more complex UI, filter intersection logic, and migration; no evidence that multiple agents per trip is desired.
   - Effort: Medium-High

### Recommendation

Use Approach 1 (nullable FK). The issue explicitly asks for one assigned agent per trip, and all agents can see all trips. A nullable FK on `trips` is the minimal, correct model. It also aligns with the existing `items.supplier_id` pattern.

### Risks

- **Term collision**: The word "agent" is already overloaded (the single travel-agent user, the AI WhatsApp agent). Use the names `travel_agent`, `TravelAgent`, and `assignedAgentId` consistently to avoid confusion.
- **Public exposure**: The issue does not mention exposing the assigned agent on the public trip view (`/t/[slug]`). Keep `assigned_agent_id` out of public selects and public types to avoid leaking internal assignment.
- **Mock/Supabase parity**: Every change to the Postgres schema and data functions must be mirrored in `mock-data.ts` and the mock branches of `trips.ts`; otherwise the app breaks in local dev without Supabase.
- **RLS scope**: The issue says no restriction rules between agents, so RLS should remain the existing owner-only pattern. Do not add row-level isolation based on `assigned_agent_id`.
- **Backfill**: Existing trips have no assigned agent. The FK must be nullable and the UI must handle unassigned trips gracefully.

### Ready for Proposal

Yes. The requirement is clear, the codebase has well-established patterns to copy (tags for catalog CRUD, suppliers for nullable FK), and the change is bounded. The orchestrator can proceed to `sdd-propose` with the recommendation above.

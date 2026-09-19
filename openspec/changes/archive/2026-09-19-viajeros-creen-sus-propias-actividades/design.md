# Design: Traveler-Created Trip Activities

## Technical Approach

Extend shared `items` with nullable `created_by_client_id`; keep `/t/[slug]` anonymously readable. Only a valid PIN session assigned through private `trip_clients` may write activities on a published trip. Dedicated traveler Server Actions call narrow data-layer operations, never the agent item actions. This implements the `client-auth`, `trip-itinerary`, and `public-trip-sharing` delta specs.

## Architecture Decisions

| Choice | Alternative / tradeoff | Rationale |
|---|---|---|
| Reuse `items` and add nullable creator FK | Separate table isolates ownership but duplicates rendering, ordering, and calendar behavior | Existing itinerary and calendar paths then consume traveler activities without merging two models. Null identifies existing/agent items. |
| Server-only service-role RPCs for create/update/soft-delete | Broad anon RLS writes cannot authenticate the app's PIN cookie; separate service-role selects and writes race | SQL transactions lock and recheck trip status, assignment, active day membership, item type/owner, and active state before mutation. Revoke RPC execution from `PUBLIC`, `anon`, and `authenticated`; grant only `service_role`. Never expose the key or client ID input in browser code. |
| Render controls only for signed-in assigned clients; derive owner match on server | UI-only checks are bypassable | Anonymous reading stays unchanged. Each action independently derives client ID from `getClientSession()` and validates input; failed authorization makes no write. |

## Data Flow

`PIN cookie → getClientSession → assignment eligibility → public page controls`  
`form → /t/[slug]/actions.ts → validated fields + session client ID → data facade → mock guard or service-role RPC → items → revalidatePath`

The public page remains a Server Component. Place a small interactive activity form/edit control beside each day/item, using the incumbent itinerary's visual vocabulary, keyboard focus, loading/error feedback, mobile layout, and print-hidden controls. No controls appear in draft preview, archived state, or for unassigned sessions. The RPC locks the trip before checking `status='published'`, locks the assignment and active day, and constrains update/delete by item ID, day, `type='activity'`, `created_by_client_id`, and `deleted_at IS NULL`; a concurrent unpublish, unassignment, day move/delete, or repeat delete must fail rather than write. Allocate day order while the day is locked.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/t/[slug]/page.tsx` | Modify | Resolve session/eligibility, render per-day add and owner-only controls. |
| `src/app/t/[slug]/actions.ts` | Modify | Add create/update/delete Server Actions, parse bounded fields, revalidate public trip. |
| `src/components/TravelerActivityForm.tsx` | Create | Client form/control for inline editing and clear feedback. |
| `src/lib/data/trips.ts`, `src/lib/data.ts` | Modify | Add scoped traveler operations and export through facade; map creator on reads. |
| `src/types/index.ts`, `src/lib/mock-data.ts` | Modify | Nullable creator and mock attribution/guard parity. |
| `supabase/migrations/20260918_traveler_activities.sql` | Create | Nullable FK (`ON DELETE SET NULL`)/index, three restricted transactional RPCs; preserve public read and agent RLS policies. |
| `src/lib/__tests__/traveler-activities.test.ts` | Create | Mock authorization and action/input tests. |

## Interfaces / Contracts

`Item.createdByClientId: string | null` (legacy/agent items read as null). Data facade exposes `canClientAddActivities(tripId, clientId)` and `createTravelerActivity`, `updateTravelerActivity`, `deleteTravelerActivity` taking the server-derived `clientId`, trip slug/ID, day or item ID, and only `title`, optional `startTime`, `location`, `notes`. Whitelist `type='activity'`; do not accept creator, type, day reassignment, cost, supplier, documents, metadata, or sort order from form data. Normalize/limit strings and validate time before the data call; sanitize notes in data layer. Return a stable unauthorized/not-found result without leaking another client's item details. Existing agent `createItem`/`updateItem`/`deleteItem` and publish lock remain unchanged.

## Testing Strategy

| Layer | What to test | Approach |
|---|---|---|
| Unit (RED first) | Input allowlist, signed/expired session, assignment, ownership, wrong trip/day, inactive rows, null-owner agent items | Vitest with mock mode and Server Action mocks. |
| DB integration | RPC grants and atomic predicates, concurrent unpublish/unassign/delete, anonymous read-only RLS | Supabase migration/integration tests; service-role key stays server-only. |
| E2E | Mobile/desktop add-edit-delete, signed-out view, cross-client hidden controls, calendar export, agent publish lock | Playwright plus typecheck/build. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary changes. The existing public route gains actions but does not change route resolution.

## Migration / Rollout

Deploy nullable FK and restricted RPCs before app code; no backfill is required (`null` means agent/legacy). Confirm `SUPABASE_SERVICE_ROLE_KEY` in deployed server environment; missing key fails closed, while no Supabase configuration continues in mock mode. Roll back UI/actions without dropping attribution or traveler data.

## Open Questions

None; the delta specs confirm the bounded fields and preservation of activities after unpublishing.

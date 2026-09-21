# Design: Service Document UI Changes

## Technical Approach

Keep the existing per-trip/per-traveler service model and split reads into two DTOs: a compact trip summary for initial dashboard render and one checklist detail loaded by Server Action after selection. The public itinerary performs a server-only session/ownership existence check and renders a callout below `PackingListManager`; it never loads another traveler’s checklist. Existing Server Actions remain the mutation boundary, with explicit agent, trip-resource, and lifecycle authorization.

## Architecture Decisions

| Decision | Alternatives | Rationale |
|---|---|---|
| Summary DTO plus lazy detail | Preload all checklists; new route | Minimizes RSC/client payload and signed-URL work while preserving trip context. |
| One controlled native `<dialog>` | Modal per row; custom overlay | Matches repository patterns, provides focus trapping/Escape behavior, and keeps one bounded DOM subtree. |
| Server-derived ownership and authorization | Trust client IDs; UI-only gating | Server Actions are public POST boundaries; re-reading trip/service relations prevents IDOR and cross-traveler disclosure. |
| Staged mock write and one Supabase multi-row insert | Loop over `addChecklistItem` | Validation occurs before mutation and the database statement is all-or-nothing without a schema change. |
| Dedicated service-document lifecycle guard | Reuse `assertTripEditable` | Document operations remain available for draft/published trips while archived trips reject writes. |

## Data Flow

```text
/t/[slug] + traveler cookie -> ownership/count DTO -> optional existing upload link

Trip page -> summary DTOs -> ServiceChecklistManager
                               | select service
                               v
                         Server Action -> authorized detail + signed URLs -> shared dialog
                               | mutation
                               v
                     revalidate dashboard + traveler routes; refresh summary/detail
```

The dialog opens immediately with an `aria-labelledby` heading and loading state, uses `max-height` plus an internal scroll region, reports errors with `role="alert"`, synchronizes native `close`, and returns focus to the invoking Documents button. Archived summaries remain visible but all mutation controls are absent and actions reject forged calls.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/types/index.ts` | Modify | Add `ServiceDocumentSummary` DTO (`serviceId`, `clientId`, `processed`, `total`, `awaitingReview`). |
| `src/lib/data/services.ts` | Modify | Add summary, ownership-safe presence, trip-scoped detail, and atomic bulk-create operations with mock/Supabase parity. |
| `src/app/t/[slug]/page.tsx` | Modify | Resolve signed-in traveler eligibility and render the callout immediately below packing. |
| `src/app/dashboard/trips/[id]/page.tsx` | Modify | Load summaries instead of eager checklist detail and pass archived/manageable state. |
| `src/app/dashboard/trips/[id]/ServiceChecklistManager.tsx` | Modify | Render compact rows, bulk form, and one lazy accessible dialog. |
| `src/app/dashboard/trips/[id]/actions.ts` | Modify | Add detail/bulk actions; apply `requireRole`, resource binding, lifecycle guard, and route revalidation to all service-document mutations. |
| `src/lib/data/__tests__/services.test.ts` | Modify | Cover aggregates, privacy presence, detail scoping, and atomic success/failure. |
| `src/app/t/[slug]/__tests__/page.test.tsx` | Create | Cover eligible, anonymous, unassigned, and zero-requirement callout states. |
| `src/app/dashboard/trips/[id]/__tests__/actions.test.ts` | Create | Cover published success, archived rejection, resource mismatch, and bulk behavior. |
| `src/app/dashboard/trips/[id]/__tests__/ServiceChecklistManager.test.tsx` | Create | Cover summary semantics and modal structure/states with the repository’s server-rendered component-test pattern. |
| `e2e/service-documents.spec.ts` | Create | Exercise focus return, Escape, bounded scrolling, lazy fetch, mutations, and refreshed counts in a browser. |

`src/lib/data.ts` needs no change because it already re-exports `data/services`.

## Interfaces / Contracts

```ts
type ServiceDocumentSummary = {
  serviceId: string; clientId: string;
  processed: number; total: number; awaitingReview: number;
};
```

`getServiceDocumentSummariesForTrip(tripId)` counts only `processed` as complete and only `uploaded` as awaiting review. `getServiceChecklistForTrip(tripId, serviceId)` rejects non-membership before generating signed URLs. `hasOwnedServiceRequirements(tripId, clientId)` returns only a boolean. `addChecklistItemToTripServices(tripId, input)` rejects empty labels, no targets, or any invalid target before inserting one independent item per service with each service’s next sort order.

## Testing Strategy

Strict TDD applies: add each failing Vitest/Playwright assertion first, then implement, then refactor. Data tests prove status counts and zero writes after invalid bulk validation in both modes. Action tests prove authentication, resource binding, draft/published success, archived denial, and revalidation. Route/component tests prove privacy, compact rendering, one lazy fetch, error states, and accessible modal behavior. Finish with `npm run test`, `npm run test:e2e`, `npx tsc --noEmit`, `npm run lint`, and `npm run build`.

## Threat Matrix

N/A — no route definitions, redirects, shell/subprocess, VCS automation, executable classification, or process-integration boundary changes; the existing route gains conditional content and an existing link only. Authorization/privacy threats are addressed above.

## Migration / Rollout

No migration or feature flag is required. Deploy code and tests together; rollback reverts them together.

## Open Questions

None.

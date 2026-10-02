# Proposal: Servicio de Visas

## Intent

TravelHub has a complete, working pattern for a top-level service that is assigned to clients, carries a status lifecycle, and supports agent-uploaded and traveler-requested documents (the `trips` domain). The product needs a new, separate service for visa applications — "un servicio nuevo que es de visas, muy similar a los viajes, pero específico." Visas differ semantically from trips: no day-by-day itinerary, destination is a country/consulate, and the status vocabulary is specific (`pending → in_progress → completed`). Reusing trips directly would pollute the trip type, public trip view, and status lifecycle with visa-specific fields. This change introduces a dedicated `visas` domain that mirrors the trips architecture but stays fully separate.

## Scope

### In Scope

- New `visas` domain: create, list, view, and edit visa applications; assign one or more clients to a visa (mirroring trip client assignment).
- Minimal visa status lifecycle: `pending → in_progress → completed` (append-only status history, mirroring `trip_status_history`).
- Required fields at creation: `country`, `visa_type`, `deadline`, `price`. Additional fields kept minimal but the schema/types are extensible.
- Per-visa-application documents: a new `visa_documents` model owned by the visa application itself (NOT the per-client `services`/`service_checklist_items` model). Supports both agent upload and traveler request-upload flows.
- Client portal: travelers see their visa applications and upload documents at `/client/visas/[id]/documents` (mirror of `/client/trips/[id]/documents`).
- Feature gating: register `visas` in the `Feature` catalog and dashboard nav so an admin can toggle it per agent.

### Out of Scope

- Approval/rejection states or a multi-stage submission workflow (decision: minimal lifecycle only).
- Number-of-entries, consulate contact, biometrics scheduling, or other visa-specific fields beyond `country`, `visa_type`, `deadline`, `price` (noted as extensible for later).
- Public/trip-style sharing route for visas (`/v/{slug}`) — visas are dashboard + authenticated-client-portal only.
- MCP tooling to expose visa data (deferred until the core domain stabilizes).
- Reuse of the existing `services` table for visa documents (explicitly rejected by product decision #3).

## Capabilities

> This section is the CONTRACT between proposal and specs phases.
> The sdd-spec agent reads this to know exactly which spec files to create or update.

### New Capabilities

- `visa-management`: Create, list, view, and edit visa applications; assign/unassign clients; enforce the `pending → in_progress → completed` status lifecycle with append-only status history; filter the visa list. Covers `src/lib/data/visas.ts`, `src/app/dashboard/visas/**`, and the `visas`/`visa_clients`/`visa_status_history` schema.
- `visa-documents`: Per-visa-application document model supporting both agent upload and traveler request-upload, including request/re-upload review flows and server-side-only storage access. Covers `visa_documents` schema, the `visa-documents` storage bucket, and `src/lib/data/visa-documents.ts`.
- `visa-client-portal`: Traveler-facing surface that lists the traveler's visa applications and lets them upload documents for a specific visa application. Covers `/client/visas/[id]/documents` and the visa summary on the client home.

### Modified Capabilities

- `agent-feature-management`: The recognized feature catalog grows from six to seven — `visas` is added to `AVAILABLE_FEATURES` and `FEATURE_DEFINITIONS`. Requirement-level change: the catalog of recognized features, the feature-assignment write path, and the admin feature-management UI now include `visas`.
- `data-layer-domain-boundaries`: The `src/lib/data.ts` facade export surface gains the new `visas` and `visa-documents` domain modules, extending the facade-export-compatibility and mock/Supabase behavior-preservation contracts to the new domain.

## Approach

Adopt **Approach 2** from the exploration: a new top-level `visas` domain that mirrors the trips architecture but stays separate. Concretely:

1. **Schema (source of truth)**: add a new Supabase migration defining `visas`, `visa_clients` (many-to-many, with `visas.client_id` kept only as a compatibility mirror of the first assigned client, matching the trips pattern), `visa_status_history` (append-only), and `visa_documents` (owned by `visas.id`, not `services`). Add RLS policies and a private `visa-documents` storage bucket.
2. **Types & feature gating**: add `Visa`, `VisaStatus = "pending" | "in_progress" | "completed"`, `VisaFilters`, `VisaWithDetails`, `VisaStatusHistoryEntry`, and visa document types to `src/types/index.ts`; add `"visas"` to the `Feature` union and register it in `src/lib/auth/features.ts`.
3. **Data layer**: create `src/lib/data/visas.ts` (CRUD, client assignment, status history, list filters) and `src/lib/data/visa-documents.ts` (per-visa upload/request/review), each branching on `isSupabaseConfigured()` with `src/lib/mock-data.ts` fallback. Re-export both from the `src/lib/data.ts` facade.
4. **Dashboard UI**: mirror the trips routes — `/dashboard/visas` (list), `/dashboard/visas/new` (create), `/dashboard/visas/[id]` (detail/edit + documents).
5. **Client portal**: mirror the trip document flow — `/client/visas/[id]/documents` for traveler uploads, plus visa visibility on the client home.
6. **Document ownership**: visa documents are per-visa application; the existing `services`/`service_checklist_items`/`service_uploads` tables are NOT reused. The proven upload status vocabulary (`uploaded`, `processed`, `re_upload_requested`) and server-side-only storage access pattern are reused for `visa_documents`.

`strict_tdd` applies: RED-GREEN-REFACTOR per task; the visa-specific edge cases (status history transitions, client-assignment diffing, document re-upload compensation) must be tested, not just the happy path.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/types/index.ts` | Modified | Add `Visa`, `VisaStatus` (`pending\|in_progress\|completed`), `VisaFilters`, `VisaWithDetails`, `VisaStatusHistoryEntry`, visa document types; add `"visas"` to the `Feature` union. |
| `src/lib/auth/features.ts` | Modified | Add `visas` to `AVAILABLE_FEATURES` and `FEATURE_DEFINITIONS` (`href: "/dashboard/visas"`). |
| `supabase/migrations/` | New | New migration: `visas`, `visa_clients`, `visa_status_history`, `visa_documents` tables, RLS policies, and private `visa-documents` storage bucket. |
| `src/lib/data/visas.ts` | New | CRUD, client assignment, status history, list filters — mirrors `src/lib/data/trips.ts`. |
| `src/lib/data/visa-documents.ts` | New | Per-visa document upload/request/review logic (agent + traveler) with server-side-only storage. |
| `src/lib/data.ts` | Modified | Re-export `visas` and `visa-documents` domain modules from the facade. |
| `src/lib/mock-data.ts` | Modified | Mock visas, `visa_clients`, `visa_status_history`, `visa_documents`. |
| `src/app/dashboard/visas/page.tsx` | New | Visa list (mirrors `/dashboard/trips/page.tsx`). |
| `src/app/dashboard/visas/new/page.tsx` + `actions.ts` | New | Create visa form (mirrors `/dashboard/trips/new`). |
| `src/app/dashboard/visas/[id]/page.tsx` + `actions.ts` | New | Visa detail/edit + document management. |
| `src/app/client/visas/[id]/documents/page.tsx` + `actions.ts` | New | Traveler document upload portal (mirrors `/client/trips/[id]/documents`). |
| `src/app/client/page.tsx` | Modified | Show the traveler's visa applications/progress alongside trips. |
| `src/lib/data/dashboard.ts` | Modified | Include visas in recent activity/stats where applicable. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Visa document ownership leaks into the trips `services` model or vice versa | Med | Keep `visa_documents` as its own table/bucket with dedicated RLS and storage paths; never extend `ServiceType`. |
| Under-testing visa-specific edge cases (status history, client-assignment diffing, re-upload compensation) | Med | `strict_tdd`: RED-GREEN-REFACTOR with scenarios for each transition and document operation, not just the happy path. |
| Feature-flag rollout leaves existing profiles without `visas` | Med | Add `visas` to the catalog and update account-profile mocks/tests; document that admins must toggle the flag for existing agents. |
| Replicating trips boilerplate introduces drift between the two domains | Low | Mirror trips deliberately and reference it in design; accept duplication for clean separation (Approach 2 tradeoff). |

## Rollback Plan

- **Schema**: the migration is additive (new tables + new bucket). Revert by dropping the new migration's objects (`visa_documents`, `visa_status_history`, `visa_clients`, `visas` tables and the `visa-documents` bucket) and removing the migration file. No existing tables are altered.
- **Feature gating**: remove `"visas"` from the `Feature` union, `AVAILABLE_FEATURES`, and `FEATURE_DEFINITIONS`; this hides the dashboard nav entry immediately.
- **Code**: the new `src/lib/data/visas.ts`, `src/lib/data/visa-documents.ts`, and `/dashboard/visas/**` + `/client/visas/**` routes are self-contained. Revert the change's commits; `src/lib/data.ts` and `src/types/index.ts` diffs revert cleanly because the additions are additive and feature-gated.
- **Client home**: the visa summary on `src/app/client/page.tsx` is additive and hidden when no visa data exists; reverting its diff restores the prior view.

## Dependencies

- Supabase migrations as the source of truth for schema/RLS/storage (existing project convention).
- Existing `data-layer-domain-boundaries` and `agent-feature-management` contracts, which this change extends.
- No external services or third-party APIs.

## Success Criteria

- [ ] An agent can create a visa application with `country`, `visa_type`, `deadline`, and `price`, and assign one or more clients.
- [ ] The visa list shows filters and reflects the `pending → in_progress → completed` lifecycle; status changes are recorded in append-only history.
- [ ] The agent can attach documents to a specific visa application, and request documents from the assigned traveler.
- [ ] A traveler can see their visa applications and upload documents at `/client/visas/[id]/documents`.
- [ ] Visa documents are scoped to the visa application, not the client; no `services`/`service_checklist_items` changes.
- [ ] `visas` appears in the feature catalog and can be toggled per agent; existing profiles are unaffected until an admin enables it.
- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, and `npm run build` all pass; visa-specific scenarios are covered by unit tests.

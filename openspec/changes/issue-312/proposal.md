# Proposal: Document portal per service with client checklist

## Intent

Travelers must submit documents the agent requires per trip, but there is no per-client
checklist or upload surface. Add a portal: the agent defines a checklist, the authenticated
client uploads one file per item, and the agent processes files externally (downloads, then
deletes from the portal). The client sees a visual checklist with per-item status.

## Scope

### In Scope

- Migration: `services`, `service_checklist_items`, `service_uploads` (indexes, RLS, bucket path).
- Data module `src/lib/data/services.ts` (dual-mode mock/Supabase).
- Client route `/client/trips/[id]/documents/` + Server Actions (service role).
- Agent checklist editor in trip sidebar; process/reject with comment.
- Auto-create service on trip↔client assignment; cascade in `deleteTrip`.
- New types + mock data.

### Out of Scope

- External agent ingestion (download/delete from portal) — agent-owned, outside the app.
- Visas / other `service_type` values (polymorphic schema; only `trip_documents` ships).
- Client Supabase Auth (email+PIN cookie session unchanged).

## Decision

**One service per (trip, client) pair**, unique on `(trip_id, client_id, service_type)`.
Rationale: "ese registro servicio-cliente tiene un checklist" implies per-client; a shared trip
needs per-client requirements; it matches future per-traveler services (visas). Tradeoffs: more
rows, complex auto-create hook, agent manages multiple checklists per trip. Rejected alternative
(one per trip) collapses distinct clients' checklists and progress.

## Capabilities

### New

- `service-auto-creation`: create service on client assignment; cascade on delete.
- `service-checklist-management`: agent add/edit/delete/reorder items.
- `client-document-upload`: one file per item; re-upload replaces (upsert + delete old object).
- `service-upload-review`: agent marks `processed` or `re_upload_requested` with comment.
- `client-document-progress`: client checklist with statuses + home counter.

### Modified

- None (additive; existing specs unchanged).

## Approach

New `services.ts` mirrors `documents.ts`/`trips.ts` and re-exports via `src/lib/data.ts`.
Storage: bucket `trip-documents`, prefix `services/{serviceId}/{checklistItemId}/...`. Client
reads/writes use Server Actions + service role. Auto-create hooks into `createTrip` and
`setTripClients`; `deleteTrip` removes services, items, uploads, and storage objects.
Status flow: `uploaded` → `processed` | `re_upload_requested`.

## Affected Areas

| Area | Impact |
|------|--------|
| `supabase/migrations/` | New migration |
| `src/lib/data/services.ts` | New |
| `src/lib/data/documents.ts` | Modified (service upload helper) |
| `src/lib/data/trips.ts` | Modified (auto-create + cleanup) |
| `src/app/dashboard/trips/[id]/` | Modified (checklist editor) |
| `src/app/client/page.tsx` | Modified (link + counter) |
| `src/app/client/trips/[id]/documents/` | New route |
| `src/types/index.ts`, `src/lib/mock-data.ts` | Modified |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| No client Auth user | High | All portal DB/storage via Server Actions + service role |
| Private bucket policy | Med | Server-side signed URLs only |
| Orphan on re-upload | Med | Upsert + delete prior object |
| Orphan on trip delete | Med | Extend `deleteTrip` cascade |
| Mock-mode regressions | Low | Seed mock arrays |

## Rollback Plan

Down migration drops the three tables; revert `services.ts`, route changes, and
`trips.ts`/`documents.ts` hooks. No existing table is altered, so the rest is untouched.

## Success Criteria

- [ ] One file per item; re-upload replaces with no orphans.
- [ ] Agent status (`processed`/`re_upload_requested`) visible to client.
- [ ] Service auto-created per pair and deleted with trip.
- [ ] Typecheck, lint, unit, build pass; mock mode works without Supabase.

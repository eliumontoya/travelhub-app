# Design: Document portal per service with client checklist

## Technical Approach

Add a per-(trip, client) "service" as the container for a checklist and its uploads. A `trip_documents` service is auto-created on trip↔client assignment, the agent defines its checklist, the authenticated client uploads one file per item through service-role Server Actions, and the agent marks uploads `processed` (deletes the file) or `re_upload_requested` (with comment). Mirrors the existing dual-mode data layer, `trip-documents` bucket, and co-located Server Action conventions.

## Architecture Decisions

| Decision | Choice | Alternative rejected | Rationale |
|---|---|---|---|
| Service granularity | One service per (trip, client), unique `(trip_id, client_id, service_type)` | One per trip | Spec: "ese registro servicio-cliente tiene un checklist"; enables future per-traveler visas |
| Storage layout | Reuse `trip-documents`, prefix `services/{serviceId}/{checklistItemId}/{ts}-{file}` | New bucket | Keeps one private bucket; service role bypasses its `auth.uid()` policy |
| Client access path | Client portal → Server Actions → `getSupabaseAdmin()`; RLS authenticated-only (0026 pattern) | Client-side Supabase | Client has no Auth identity; service role is the only safe read/write |
| Upload module location | `src/lib/data/services.ts` (reuses `DOCUMENTS_BUCKET`, `sanitizeStorageKey`, `getSignedDocumentUrl`) | Extend `documents.ts` | Single new module mirroring `documents.ts`; `data.ts` re-exports it |
| Re-upload | Upsert on `(service_id, checklist_item_id)` + delete prior storage object + reset status/comment | Insert-only | One file per item; avoids orphans |
| Auto-create hook | `createTrip` after `trip_clients` insert; `setTripClients` for `toAdd` | Trigger | Follows existing mutation points; keeps logic in data layer |

## Data Model

**services** — `id` (uuid pk), `trip_id` (fk→trips cascade), `client_id` (fk→clients cascade), `service_type` (text, default `'trip_documents'`), `status` (text default `'active'`), `created_at`, `updated_at`; unique `(trip_id, client_id, service_type)`.

**service_checklist_items** — `id`, `service_id` (fk cascade), `label` (text), `required` (bool default true), `sort_order` (int default 0), `created_at`, `updated_at`.

**service_uploads** — `id`, `service_id` (fk cascade), `checklist_item_id` (fk cascade), `file_path` (text), `filename`, `mime_type`, `status` (`uploaded|processed|re_upload_requested` default `uploaded`), `agent_comment`, `file_removed` (bool default false), `uploaded_at`, `updated_at`; unique `(service_id, checklist_item_id)`.

Indexes on every fk. `service_type`/`service_ref_id` remain extensible for future visas (only `trip_documents` ships).

## File Changes

| File | Action | Description |
|---|---|---|
| `supabase/migrations/20260919000000_service_documents.sql` | Create | 3 tables, indexes, unique constraints, RLS (authenticated-only) |
| `src/types/index.ts` | Modify | `ServiceType`, `Service`, `ServiceChecklistItem`, `ServiceUpload`, `ServiceUploadStatus`, `ServiceWithChecklist`, `ServiceChecklistItemWithUpload`; add `serviceProgress` to `ClientHomeTrip` |
| `src/lib/data/services.ts` | Create | Dual-mode CRUD + upload/download + progress aggregate |
| `src/lib/data.ts` | Modify | Re-export `@/lib/data/services` |
| `src/lib/data/trips.ts` | Modify | `createTrip`/`setTripClients` auto-create; `deleteTrip` storage cleanup |
| `src/lib/mock-data.ts` | Modify | `mockServices`, `mockServiceChecklistItems`, `mockServiceUploads` |
| `src/app/client/trips/[id]/documents/page.tsx` + `actions.ts` | Create | Client checklist + upload Server Actions |
| `src/app/client/page.tsx` | Modify | Per-trip "Documentos" link + progress counter |
| `src/app/dashboard/trips/[id]/page.tsx` + `actions.ts` | Modify | Checklist editor + upload review |

## Interfaces / Contracts

```ts
// services.ts (dual-mode; service role for client reads/writes)
ensureServiceForAssignment(tripId, clientId): Promise<Service>          // upsert on unique key
getServiceForClientTrip(clientId, tripId): Promise<Service | null>
getServicesForTrip(tripId): Promise<Service[]>                          // agent
addChecklistItem(serviceId, { label, required }): Promise<ServiceChecklistItem>
updateChecklistItem(id, { label, required }): Promise<void>
deleteChecklistItem(id): Promise<void>                                   // also removes upload + object
reorderChecklistItems(serviceId, orderedIds): Promise<void>
getServiceWithChecklist(serviceId): Promise<ServiceWithChecklist>        // items + latest upload (+signed url)
uploadServiceDocument(serviceId, checklistItemId, file): Promise<ServiceUpload> // upsert + delete old object
markUploadProcessed(uploadId): Promise<void>                             // delete object, file_removed=true
requestReUpload(uploadId, comment): Promise<void>                        // reject empty comment
getServicesProgressForClient(clientId): Promise<Map<string,{completed,total}>>
rowToService / rowToServiceChecklistItem / rowToServiceUpload(row)
```

Client actions (`actions.ts`) expose only `uploadServiceDocument` and read-only fetch; checklist/status mutations stay agent-side.

## Data Flow

```
agent assigns client ──▶ createTrip/setTripClients ──▶ ensureServiceForAssignment (upsert)
client uploads ──▶ /client/trips/[id]/documents action ──▶ getSupabaseAdmin() ──▶ storage + upsert
agent reviews ──▶ dashboard actions ──▶ markUploadProcessed/requestReUpload ──▶ status + storage delete
deleteTrip ──▶ collect service_uploads.file_path ──▶ storage.remove ──▶ trips.delete (DB cascade)
```

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Unit (Vitest) | Auto-create idempotency, re-upload upsert + old-object deletion, reorder, progress count (only `processed` counts), empty-comment rejection | Mock-mode data functions |
| Integration | `deleteTrip` removes services/items/uploads in mock arrays; migration RLS/index correctness | Data-layer tests + `supabase db reset` |
| E2E (Playwright) | Client upload → agent process → client sees ✓; re-upload request shows ⚠ + comment | Existing Playwright setup |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

Single additive migration; no existing table altered. Down migration drops the three tables; revert `services.ts`, route, and `trips.ts` hooks.

## Open Questions

- [ ] Should `setTripClients` deletion of a client also delete that client's service? (recommended: yes, cascade; confirm in tasks)
- [ ] Display the progress counter as "completed/total" only, or also a percentage bar on home?

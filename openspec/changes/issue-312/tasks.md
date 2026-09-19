# Tasks: Document portal per service with client checklist

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1100–1250 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 → PR 4 |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Foundation: migration + types + mock data + data layer | PR 1 | `npm run test -- --run services` | `npx tsc --noEmit && npm run build` | Remove `services.ts`, migration, types, mock seeds |
| 2 | Auto-creation hook + deleteTrip cascade | PR 2 | `npm run test -- --run auto-create` | `npx tsc --noEmit` | Revert `trips.ts` hook changes |
| 3 | Client portal + progress counter | PR 3 | `npm run test -- --run client-portal` | Playwright client upload flow | Remove client route, actions, home changes |
| 4 | Agent checklist editor + upload review | PR 4 | `npm run test -- --run agent-review` | `npm run build` | Remove dashboard checklist/review UI |

## Phase 1: Foundation (PR 1 — migration, types, mock data, data layer)

- [ ] 1.1 **RED** — Write failing tests in `src/lib/data/__tests__/services.test.ts` for: `ensureServiceForAssignment` idempotency, `getServiceForClientTrip`, `addChecklistItem`, `deleteChecklistItem` (with upload+object cleanup), `reorderChecklistItems`, `uploadServiceDocument` (upsert + old object deletion), `markUploadProcessed` (object delete + `file_removed`), `requestReUpload` (empty-comment rejection), `getServicesProgressForClient` (only `processed` counts).
- [ ] 1.2 Create migration `supabase/migrations/20260919000000_service_documents.sql`: tables `services`, `service_checklist_items`, `service_uploads`; fk indexes; unique `(trip_id, client_id, service_type)` and `(service_id, checklist_item_id)`; RLS `authenticated`-only on all three.
- [ ] 1.3 Add types to `src/types/index.ts`: `ServiceType`, `Service`, `ServiceChecklistItem`, `ServiceUpload`, `ServiceUploadStatus`, `ServiceWithChecklist`, `ServiceChecklistItemWithUpload`; add `serviceProgress: { completed: number; total: number }` to `ClientHomeTrip`.
- [ ] 1.4 Add mock seeds to `src/lib/mock-data.ts`: `mockServices`, `mockServiceChecklistItems`, `mockServiceUploads`.
- [ ] 1.5 **GREEN** — Create `src/lib/data/services.ts` (dual-mode mock/Supabase) implementing all functions from design §Interfaces. Client reads/writes use `getSupabaseAdmin()` service role. Re-export from `src/lib/data.ts`.
- [ ] 1.6 Run `npm run test -- --run services`, `npx tsc --noEmit`, `npm run build` — all green.

## Phase 2: Auto-creation & Cascade (PR 2)

- [ ] 2.1 **RED** — Add tests for: `createTrip` auto-creates service per assigned client; `setTripClients` `toAdd` auto-creates; `setTripClients` removal DELETES client's service+uploads+storage objects; `deleteTrip` cascades services/items/uploads+storage.
- [ ] 2.2 Modify `src/lib/data/trips.ts`: in `createTrip`, after `trip_clients` insert call `ensureServiceForAssignment` per client. In `setTripClients`, call it for `toAdd` entries; for removed clients, delete their service (cascading checklist items, uploads, and storage objects). In `deleteTrip`, collect all `service_uploads.file_path` for the trip's services, remove storage objects, then delete (DB cascade handles rows).
- [ ] 2.3 Run `npm run test -- --run auto-create`, `npx tsc --noEmit` — all green.

## Phase 3: Client Portal & Progress (PR 3)

- [ ] 3.1 **RED** — Write tests for client portal actions: `uploadServiceDocument` rejects cross-client item; progress aggregate returns correct `{completed, total}` per service; only `processed` counts as completed.
- [ ] 3.2 Create `src/app/client/trips/[id]/documents/actions.ts`: `uploadDocument(serviceId, checklistItemId, file)` — validates ownership via `getServiceForClientTrip`, delegates to `uploadServiceDocument`. No checklist mutation exposed.
- [ ] 3.3 Create `src/app/client/trips/[id]/documents/page.tsx`: checklist view with status indicators (pending/uploaded/processed/re_upload_requested), upload input per item, agent comment display on ⚠ items. Text "N/M" progress counter (no progress bar).
- [ ] 3.4 Modify `src/app/client/page.tsx`: add per-trip "Documentos" link and `serviceProgress` text counter using `getServicesProgressForClient`.
- [ ] 3.5 Run `npm run test -- --run client-portal`, `npx tsc --noEmit`, `npm run build` — all green.

## Phase 4: Agent Checklist Editor & Upload Review (PR 4)

- [ ] 4.1 **RED** — Write tests for: `requestReUpload` with empty comment throws; `markUploadProcessed` sets `file_removed=true` and deletes object; client cannot call status-transition functions (enforced by action surface, not data layer).
- [ ] 4.2 Modify `src/app/dashboard/trips/[id]/actions.ts`: add `addChecklistItem`, `updateChecklistItem`, `deleteChecklistItem`, `reorderChecklistItems`, `markUploadProcessed`, `requestReUpload` server actions wrapping `services.ts`.
- [ ] 4.3 Modify `src/app/dashboard/trips/[id]/page.tsx`: checklist editor (add/edit/delete/reorder items) and upload review panel (mark processed / request re-upload with comment).
- [ ] 4.4 Run full suite: `npm run test`, `npx tsc --noEmit`, `npm run build` — all green.

# Design: Servicio de Visas

## Technical Approach

Implement a new top-level `visas` domain that mirrors the existing `trips` architecture but remains fully separate at every layer: schema, types, feature gating, data access, dashboard UI, and client portal. This is Approach 2 from the exploration, confirmed by the proposal.

The change is deliberately additive and self-contained:

- **Schema** — one new Supabase migration introducing `visas`, `visa_clients` (M2M), `visa_status_history` (append-only), and `visa_documents` (owned by `visas.id`, NOT by the trips `services` model), plus RLS policies and a private `visa-documents` storage bucket. No existing tables or buckets are altered.
- **Types + gating** — `Visa`, `VisaStatus`, `VisaFilters`, `VisaWithDetails`, `VisaStatusHistoryEntry`, and visa document types are added to `src/types/index.ts`; `"visas"` joins the `Feature` union and the `FEATURE_DEFINITIONS`/`AVAILABLE_FEATURES` catalogs.
- **Data layer** — `src/lib/data/visas.ts` (CRUD, client assignment diffing, status transitions, list filters) and `src/lib/data/visa-documents.ts` (per-visa upload/request/review), each branching on `isSupabaseConfigured()` with `src/lib/mock-data.ts` fallback, re-exported from the `src/lib/data.ts` facade.
- **UI** — `/dashboard/visas` (list), `/dashboard/visas/new` (create), `/dashboard/visas/[id]` (detail/edit + documents), and `/client/visas/[id]/documents` (traveler upload), plus a visa summary on the client home.

Two intentional deviations from the trips pattern are required by the specs and documented as decisions below: (1) visas use a strict forward-only status lifecycle via a dedicated transition function (trips allow arbitrary `updateTrip` status edits), and (2) visas MAY have zero assigned clients (trips enforce a minimum of one).

## Architecture Decisions

### Decision: New top-level `visas` domain (not a trip variant, not a `services` child)

**Choice**: Mirror the `trips` architecture into a fully separate `visas` domain — own tables (`visas`, `visa_clients`, `visa_status_history`, `visa_documents`), own types, own data module, own routes, own feature flag, own storage bucket (`visa-documents`).

**Alternatives considered**:
- *Extend trips with a `trip_type`/category* (Approach 1) — rejected: pollutes the `Trip` type and `trips` table with nullable visa fields, and leaks into the public `/t/{slug}` view and status lifecycle.
- *Build visas on the existing `services` table* (Approach 3) — rejected: `services.trip_id` is `NOT NULL` and the model is a per-client checklist child, not a top-level service; decoupling it would risk the RLS/storage paths shared with trips.

**Rationale**: The product intent is a *new* service semantically distinct from trips (no itinerary, country/consulate destination, dedicated status vocabulary). Full separation preserves the trips domain untouched and matches the issue wording ("un servicio nuevo ... muy similar a los viajes, pero específico"). Duplicated CRUD/list boilerplate is an accepted cost of clean boundaries (explicit tradeoff in the proposal).

### Decision: `visa_documents` as a single unified table owned by `visas.id`

**Choice**: A single `visa_documents` table that collapses the trips `service_checklist_items` + `service_uploads` two-table split into one row per document, with `visa_id` as the only parent, a nullable `target_client_id` (agent uploads leave it null; traveler requests set it), a nullable `file_path` (null until a file is uploaded), and a `status` column.

**Alternatives considered**:
- *Reuse `services`/`service_checklist_items`/`service_uploads`* — rejected by product decision #3 and the spec ("MUST NOT share storage, rows, or identifiers").
- *Two tables (visa_checklist_items + visa_uploads)* — rejected as unnecessary: the spec models requests and uploads as states of one document row (`requested → uploaded → reviewed/processed/re_upload_requested`), not as two entities.

**Rationale**: The spec's document model is a single lifecycle: an agent either uploads directly (`uploaded`) or requests a file from an assigned traveler (`requested`), and the traveler upload transitions `requested`/`re_upload_requested → uploaded`. One row per document expresses this with less schema and no cross-table join, while remaining fully isolated from the trips `services` model.

### Decision: Strict forward-only status lifecycle via a dedicated transition function

**Choice**: Encode the lifecycle as an explicit transition map (`pending → in_progress`, `in_progress → completed`, `completed` terminal) in a single `transitionVisaStatus(visaId, toStatus)` function. Editing mutable fields goes through a separate `updateVisa` that MUST NOT touch `status`.

**Alternatives considered**: Reuse the trips pattern where `updateTrip` accepts an arbitrary `status` patch and appends history inline — rejected because the visa spec mandates rejecting backward and skip transitions and treating `completed` as terminal, which a free-form `updateVisa({status})` cannot guarantee.

**Rationale**: Centralizing the transition rule in one function makes the allowed-path enforcement testable and prevents any action from bypassing it. `updateVisa` excludes `status` from its input type so the compiler plus a runtime guard keep field edits and status changes disjoint.

### Decision: Client assignment mirrors trips M2M but allows zero clients

**Choice**: `visa_clients` is the source of truth for "assigned clients"; `visas.client_id` is a nullable compatibility mirror of `clientIds[0]`. `setVisaClients(visaId, clientIds)` computes a diff (remove dropped + upsert added, preserving `created_at` for retained rows) rather than delete-all-then-reinsert.

**Alternatives considered**: Copy trips' "minimum one client" rule — rejected because the visa spec explicitly allows "Unassigning all clients leaves visa with no assignments" and the `visa_clients` set can be empty.

**Rationale**: The diff-based set operation preserves assignment order and is idempotent (matching the spec's "idempotent set operation" requirement). Unlike trips, no `ensureServiceForAssignment` side effect fires on assignment because visa documents are per-visa, not per-client.

### Decision: Feature-gated with `requireFeature("visas")` at the page boundary

**Choice**: Add `"visas"` to the `Feature` union, `AVAILABLE_FEATURES`, and `FEATURE_DEFINITIONS` (`href: "/dashboard/visas"`), add a hardcoded entry to `DashboardSidebarNav`'s `navItems`, and call `requireFeature("visas")` at the top of every `/dashboard/visas/**` server page.

**Alternatives considered**: Relying only on `FEATURE_DEFINITIONS` (no sidebar change) — rejected because `DashboardSidebarNav` currently uses its own hardcoded `navItems` array, not `FEATURE_DEFINITIONS`; the nav entry would not render without editing it.

**Rationale**: `requireFeature` is the existing server-side guard used by `clients`/`suppliers`/`settings` pages (admins always pass; agents need the flag). The trips *list* page currently omits this guard — a known inconsistency — but the visa spec requires gating, so visa pages follow the stricter, correct pattern rather than the trips omission.

### Decision: Private `visa-documents` storage bucket with server-side-only access

**Choice**: A new private bucket `visa-documents` (created via SQL, `public = false`), objects stored under `visas/{visaId}/...`, and a dedicated `getSignedVisaDocumentUrl` helper. No public URL is ever returned; reads/downloads go through authenticated server actions.

**Alternatives considered**: Reusing the `trip-documents` bucket — rejected because it would share storage paths with the trips domain, violating the "no cross-domain leakage" requirement.

**Rationale**: Reuses the proven private-bucket + signed-URL pattern from `trip-documents`/`service_uploads` but keeps every storage object under a distinct bucket and path prefix so trip and visa documents can never collide or leak.

## Data Flow

### Status lifecycle (dashboard)

```
Agent action            transitionVisaStatus            DB
────────────            ────────────────────            ──
create visa ──► createVisa(country, visa_type,          visas (status='pending')
                deadline, price) ──► append history     visa_status_history
                {from:null, to:'pending'}
advance ──────► transitionVisaStatus(id,'in_progress')  visas.status='in_progress'
               (allowed: pending→in_progress) ──► append {from:pending,to:in_progress}
advance ──────► transitionVisaStatus(id,'completed')    visas.status='completed'
               (allowed: in_progress→completed) ──► append
backward/skip ► rejected, no write, no history row
```

### Document flows

```
AGENT upload               uploadVisaDocument(visaId, file)
  └─ visa_documents row {target_client_id:null, file_path:visas/{id}/..., status:'uploaded'}

AGENT request              requestVisaDocument(visaId, clientId, description)
  └─ validate clientId ∈ visa_clients(visaId)
  └─ visa_documents row {target_client_id:clientId, description, file_path:null, status:'requested'}

TRAVELER upload            uploadVisaDocumentForRequest(documentId, clientId, file)
  └─ validate document.target_client_id === clientId
  └─ upload file → update row (file_path, status:'uploaded') → remove old object (compensation)

AGENT review               markVisaDocumentReviewed / markVisaDocumentProcessed / requestVisaDocumentReUpload
  └─ uploaded → reviewed → processed        (or)   uploaded → re_upload_requested(+comment)
```

### Cross-domain isolation

```
visas module ──► tables: visas, visa_clients, visa_status_history
visa-documents module ──► tables: visa_documents ; bucket: visa-documents
(never touches trips / trip_clients / trip_status_history / trip_documents /
 services / service_checklist_items / service_uploads / trip-documents)
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `supabase/migrations/20260930000000_visas.sql` | Create | `visas`, `visa_clients`, `visa_status_history`, `visa_documents` tables; RLS policies; private `visa-documents` bucket + storage policy; backfill `visa_clients` from `visas.client_id`. |
| `src/types/index.ts` | Modify | Add `"visas"` to `Feature`; add `Visa`, `VisaStatus`, `VisaFilters`, `VisaStatusHistoryEntry`, `VisaDocumentStatus`, `VisaDocument`, `VisaWithDetails`. |
| `src/lib/auth/features.ts` | Modify | Add `"visas"` to `AVAILABLE_FEATURES` and a `FEATURE_DEFINITIONS` entry (`href: "/dashboard/visas"`). |
| `src/lib/data/visas.ts` | Create | `rowToVisa`/`rowToVisaStatusHistory`, `getVisasWithClients`, `getVisaById`, `getVisasByClientId`, `createVisa`, `updateVisa`, `setVisaClients`, `transitionVisaStatus`, `getVisaStatusHistory`. |
| `src/lib/data/visa-documents.ts` | Create | `rowToVisaDocument`, `getVisaDocuments`, `uploadVisaDocument`, `requestVisaDocument`, `uploadVisaDocumentForRequest`, `markVisaDocumentReviewed`, `markVisaDocumentProcessed`, `requestVisaDocumentReUpload`, `getSignedVisaDocumentUrl`, `assertVisaDocumentMutable`. |
| `src/lib/data.ts` | Modify | Re-export `@/lib/data/visas` and `@/lib/data/visa-documents`. |
| `src/lib/mock-data.ts` | Modify | Add `mockVisas`, `mockVisaClients`, `mockVisaStatusHistory`, `mockVisaDocuments` seed data. |
| `src/components/DashboardSidebarNav.tsx` | Modify | Add `{ href: "/dashboard/visas", label: "Visas", icon: "…" }` to `navItems` (non-admin). |
| `src/lib/data/dashboard.ts` | Modify | Optionally include visas in `getRecentActivity` (low priority; safe to omit if it risks the review budget). |
| `src/app/dashboard/visas/page.tsx` | Create | Visa list with status/client/country filters + pagination (`requireFeature("visas")`). |
| `src/app/dashboard/visas/VisaExplorer.tsx` | Create | Client component for the list (filters, status display, client chips). |
| `src/app/dashboard/visas/new/page.tsx` | Create | Create form (`requireFeature("visas")`). |
| `src/app/dashboard/visas/new/actions.ts` | Create | `createVisaAction` — validates required fields, calls `createVisa`. |
| `src/app/dashboard/visas/[id]/page.tsx` | Create | Detail/edit + document management (`requireFeature("visas")`). |
| `src/app/dashboard/visas/[id]/actions.ts` | Create | Server actions: edit fields, `setVisaClients`, `transitionVisaStatus`, document actions. |
| `src/app/client/visas/[id]/documents/page.tsx` | Create | Traveler upload portal (mirrors `/client/trips/[id]/documents`). |
| `src/app/client/visas/[id]/documents/actions.ts` | Create | `uploadVisaDocumentForRequest` server action with `getClientSession` + assignment check. |
| `src/app/client/page.tsx` | Modify | Render the traveler's visa applications/status alongside trips (additive, hidden when none). |
| `src/lib/data/__tests__/visas.test.ts` | Create | Unit tests: CRUD, setVisaClients diffing, transitionVisaStatus lifecycle, filters (mock + supabase-stub). |
| `src/lib/data/__tests__/visa-documents.test.ts` | Create | Unit tests: upload/request/review/re-upload compensation, ownership guard, storage isolation. |
| `src/lib/__tests__/visa-domain-contracts.test.ts` | Create | Facade export surface, cross-domain isolation, dual-mode parity. |
| `src/lib/__tests__/features.test.ts` | Modify | Assert `visas` is a recognized feature and appears in `FEATURE_DEFINITIONS`. |

## Interfaces / Contracts

### Types (`src/types/index.ts`)

```ts
export type VisaStatus = "pending" | "in_progress" | "completed";

export interface Visa {
  id: string;
  /** Compatibility mirror of clientIds[0] ("" when no clients assigned). */
  clientId: string;
  country: string;
  visaType: string;
  /** ISO date string (YYYY-MM-DD). */
  deadline: string;
  price: number;
  notes?: string;
  status: VisaStatus;
  createdAt: string;
  updatedAt: string;
}

export type VisaFilters = {
  query?: string;
  status?: VisaStatus[];
  clientIds?: string[];
  country?: string;
};

export interface VisaStatusHistoryEntry {
  id: string;
  visaId: string;
  fromStatus: VisaStatus | null;
  toStatus: VisaStatus;
  changedAt: string;
}

export type VisaDocumentStatus =
  | "requested"
  | "uploaded"
  | "reviewed"
  | "processed"
  | "re_upload_requested";

export interface VisaDocument {
  id: string;
  visaId: string;
  /** null for agent-uploaded documents; set for traveler requests. */
  targetClientId: string | null;
  /** Human label for a requested document. */
  description?: string;
  /** null until a file is uploaded. */
  filePath: string | null;
  filename?: string;
  mimeType?: string;
  status: VisaDocumentStatus;
  agentComment?: string;
  uploadedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisaWithDetails extends Visa {
  /** Source of truth: assigned clients, ordered by assignment (created_at asc). */
  clients: Client[];
  /** Backward-compat mirror: clients[0] or {} when empty. */
  client: Client;
  statusHistory: VisaStatusHistoryEntry[];
  documents: (VisaDocument & { url: string | null })[];
}
```

### Data-layer contracts (`src/lib/data/visas.ts`)

```ts
export type CreateVisaInput = {
  country: string;
  visaType: string;
  deadline: string;
  price: number;
  notes?: string;
  clientIds?: string[];   // optional; may be empty
};

export type UpdateVisaInput = {
  country?: string;
  visaType?: string;
  deadline?: string;
  price?: number;
  notes?: string | null;
  // status intentionally absent — use transitionVisaStatus
};

const VISA_TRANSITIONS: Record<VisaStatus, VisaStatus[]> = {
  pending: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

getVisasWithClients(params: PaginationParams & { filters?: Partial<VisaFilters> })
  : Promise<PaginatedResult<Visa & { clients: Client[] }>>
getVisaById(id: string): Promise<VisaWithDetails | null>
getVisasByClientId(clientId: string): Promise<Visa[]>
createVisa(input: CreateVisaInput): Promise<Visa>
updateVisa(id: string, input: UpdateVisaInput): Promise<Visa>
setVisaClients(visaId: string, clientIds: string[]): Promise<void>
transitionVisaStatus(visaId: string, toStatus: VisaStatus): Promise<VisaStatusHistoryEntry>
getVisaStatusHistory(visaId: string): Promise<VisaStatusHistoryEntry[]>
```

### Data-layer contracts (`src/lib/data/visa-documents.ts`)

```ts
export const VISA_DOCUMENTS_BUCKET = "visa-documents";

getVisaDocuments(visaId: string): Promise<(VisaDocument & { url: string | null })[]>
uploadVisaDocument(visaId: string, file: File): Promise<VisaDocument>          // status 'uploaded'
requestVisaDocument(visaId: string, clientId: string, description: string): Promise<VisaDocument> // status 'requested'
uploadVisaDocumentForRequest(documentId: string, clientId: string, file: File): Promise<VisaDocument> // → 'uploaded'
markVisaDocumentReviewed(id: string): Promise<void>                             // uploaded → reviewed
markVisaDocumentProcessed(id: string): Promise<void>                            // reviewed → processed
requestVisaDocumentReUpload(id: string, comment: string): Promise<void>         // uploaded → re_upload_requested
getSignedVisaDocumentUrl(path: string): Promise<string | null>
assertVisaDocumentMutable(documentId: string, visaId: string): Promise<void>    // ownership guard
```

### Schema shape (`supabase/migrations/20260930000000_visas.sql`)

```sql
create table if not exists visas (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete set null,   -- compatibility mirror
  country text not null,
  visa_type text not null,
  deadline date not null,
  price numeric(12,2) not null,
  notes text,
  status text not null default 'pending'
    check (status in ('pending','in_progress','completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists visa_clients (
  visa_id uuid not null references visas(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (visa_id, client_id)
);
create index if not exists idx_visa_clients_client_id on visa_clients(client_id);

create table if not exists visa_status_history (
  id uuid primary key default gen_random_uuid(),
  visa_id uuid not null references visas(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_at timestamptz not null default now()
);
create index if not exists idx_visa_status_history_visa_id on visa_status_history(visa_id);

create table if not exists visa_documents (
  id uuid primary key default gen_random_uuid(),
  visa_id uuid not null references visas(id) on delete cascade,
  target_client_id uuid references clients(id) on delete set null,
  description text,
  file_path text,
  filename text,
  mime_type text,
  status text not null default 'uploaded'
    check (status in ('requested','uploaded','reviewed','processed','re_upload_requested')),
  agent_comment text,
  uploaded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_visa_documents_visa_id on visa_documents(visa_id);
create index if not exists idx_visa_documents_target_client_id on visa_documents(target_client_id);
```

RLS follows the mono-user authenticated pattern (`auth.uid() is not null`, no `anon` grants) used by `trip_clients`/`trip_status_history`/`services`. The bucket and its `storage.objects` policy mirror `0002_storage_bucket.sql` with `bucket_id = 'visa-documents'`. A backfill inserts one `visa_clients` row per existing `visas.client_id` (`on conflict do nothing`) — although the table starts empty, this keeps the migration idempotent and consistent with the `0006_trip_clients.sql` convention.

## Testing Strategy

`strict_tdd: true` — RED-GREEN-REFACTOR per task. The visa-specific edge cases named in the proposal are the primary seams.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit — status lifecycle | `transitionVisaStatus` allows only `pending→in_progress` and `in_progress→completed`; rejects backward (`in_progress→pending`), skip (`pending→completed`), and any transition from `completed`; appends a history row per success and none on rejection. | `src/lib/data/__tests__/visas.test.ts` (mock mode, reset `mockVisas`/`mockVisaStatusHistory` in `beforeEach`). |
| Unit — client assignment diffing | `setVisaClients` computes union/difference idempotently (re-assigning `C1` is a no-op); unassigning a non-member is a no-op; empty `clientIds` is allowed and leaves zero assignments; retained rows keep `created_at`; `visas.client_id` mirror = `clientIds[0]` or cleared. | `src/lib/data/__tests__/visas.test.ts` (mock mode; assert array contents + mirror). |
| Unit — create/update validation | `createVisa` rejects missing `country`/`visa_type`/`deadline`/`price` and seeds `pending` + a `{from:null,to:'pending'}` history row; `updateVisa` changes mutable fields but never `status`. | `src/lib/data/__tests__/visas.test.ts`. |
| Unit — document re-upload compensation | `uploadVisaDocumentForRequest` uploads to `visa-documents`, upserts the row, removes the previous `file_path`, and on persistence error removes the newly uploaded object (cleanup); throws `AggregateError` when cleanup also fails. `requestVisaDocument` rejects a non-assigned traveler. | `src/lib/data/__tests__/visa-documents.test.ts` using a fake Supabase client (mirrors `services.test.ts`). |
| Unit — ownership guard | `assertVisaDocumentMutable` maps a cross-visa mismatch to a generic "not found" (no probing); `uploadVisaDocumentForRequest` rejects when `document.target_client_id !== clientId`. | `src/lib/data/__tests__/visa-documents.test.ts`. |
| Integration — cross-domain isolation | Visa/visa-document operations never issue queries against `trips`/`services`/`service_checklist_items`/`service_uploads`/`trip_documents` and never call `storage.from("trip-documents")`; all storage paths live under `visa-documents`. | `src/lib/__tests__/visa-domain-contracts.test.ts` (fake client records every `from()`/`storage.from()` table/bucket). |
| Integration — facade + dual-mode parity | `src/lib/data` re-exports `createVisa`, `getVisaById`, `uploadVisaDocument`, etc.; a create → read → transition → read sequence yields equivalent results in mock and (stubbed) Supabase modes. | `src/lib/__tests__/visa-domain-contracts.test.ts` and `src/lib/__tests__/features.test.ts`. |
| Integration — feature catalog | `visas` ∈ `AVAILABLE_FEATURES`; `FEATURE_DEFINITIONS` contains `{ feature:"visas", href:"/dashboard/visas" }`; `filterFeatures` preserves/drops `visas` correctly. | Extend `src/lib/__tests__/features.test.ts`. |
| Route/action | Dashboard actions call `requireRole`/`requireFeature` and reject unauthorized; client portal actions call `getClientSession` and reject non-assigned travelers. | `src/app/dashboard/visas/[id]/__tests__/actions.test.ts`, `src/app/client/visas/[id]/documents/__tests__/actions.test.ts` (mirror `trips/[id]/__tests__/actions.test.ts`). |

## Threat Matrix

N/A — this change introduces no routing (in the shell/command sense), shell commands, subprocesses, VCS/PR automation, executable-file classification, or process-integration boundary. It adds App Router page/action files, but those are ordinary Next.js application routes, not the adversarial routing surface the threat matrix targets. No matrix rows apply; no RED tests are manufactured from it.

## Migration / Rollout

- **Schema**: additive migration (new tables + new bucket). Rollback = drop `visa_documents`, `visa_status_history`, `visa_clients`, `visas`, and the `visa-documents` bucket, then remove the migration file. No existing tables are altered.
- **Feature gating**: `visas` is off for existing agent profiles until an admin enables it (admins pass `requireFeature` regardless). Rollback = remove `"visas"` from the union, catalogs, and sidebar entry; the nav entry and routes become unreachable.
- **Code**: self-contained commits; `src/lib/data.ts` and `src/types/index.ts` diffs are additive. The client-home visa section is additive and hidden when the traveler has no visas.

## Open Questions

- [ ] Whether `visa_type` should eventually become a curated enum/catalog (e.g. "tourist", "business", "student") rather than free text. Currently modeled as free text for extensibility, per the spec's minimal-fields stance.
- [ ] Whether `price` should carry a currency dimension (e.g. reuse `TripCurrency`) or remain a bare number. Currently modeled as a bare `number` since the spec only requires `price`.
- [ ] Whether to include visas in `getRecentActivity`/dashboard stats in this change or defer it — currently marked optional to protect the 400-line review budget.
- [ ] Whether `completed` visas should be read-only in the dashboard (trips archive `published` trips from editing). The spec does not require an archive/lock; left unenforced for now.

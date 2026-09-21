# Design: MCP Service-Document Tools

## Technical Approach

Ship a **minimal MCP base** on main and register **seven service-document tools** over it, so an agent can (1) obtain a service-role signed URL to **download** a service-document file, and (2) **process / review / request-reupload** an upload over a machine-to-machine HTTP channel.

Main already ships the entire service-document **data layer** (`src/lib/data/services.ts`) — including `markUploadProcessed(id)`, which already performs exactly the requested "delete physical object + keep DB row + set `processed`" behavior. The single hardest historical blocker (injecting a service-role Supabase client) is **already solved** in main via `getSupabaseAdmin()` + `canUseServiceRole()`. What main lacks is any MCP surface (no `src/lib/mcp/`, no `src/app/api/mcp/`, no SDK dependency).

This change therefore:

1. Adds `@modelcontextprotocol/sdk@1.30.0` (exact pin).
2. Adds a stateless Streamable-HTTP MCP route `src/app/api/mcp/route.ts` with a **timing-safe Bearer allow-list gate (401)** and a **service-role availability gate (503)**.
3. Ports the reusable MCP plumbing (`auth.ts`, `errors.ts`, `tools/utils.ts`) **verbatim** from the old `feat/mcp-server-agent-actions` branch and rewrites `server.ts` + the tool layer against main's modular data layer.
4. **Drops** the old `supabase-store.ts` (AsyncLocalStorage) and the trailing `supabase?` injection entirely — main's data functions select their client internally (`getServiceClient()` → `getSupabaseAdmin()` when the service role is set).
5. Adds one service-role signed-URL helper and one ownership/archived-trip guard helper in the data layer.
6. Registers only the seven service-document tools.

The change is **additive**: no existing spec requirement is modified; the `service-upload-review` invariants are re-exposed over a new surface, not changed.

---

## Architecture

```
                            MCP client (agent)
                                   │  POST/GET/DELETE /api/mcp
                                   │  Authorization: Bearer <MCP_API_KEY>
                                   ▼
                 ┌─────────────────────────────────────────────┐
                 │  src/app/api/mcp/route.ts   (runtime=nodejs) │
                 │                                             │
                 │  1. validateMcpApiKey(authHeader) ── 401 ──► │  (timing-safe allow-list)
                 │  2. canUseServiceRole()          ── 503 ──► │  (no silent mock fallback)
                 │  3. McpServer ◄── WebStandardStreamableHTTPServerTransport (stateless)
                 └───────────────────┬─────────────────────────┘
                                     │ tool dispatch
                                     ▼
              ┌──────────────────────────────────────────────┐
              │  src/lib/mcp/server.ts  → createMcpServer()  │
              │        registers service-document tools only │
              └──────────────────────┬───────────────────────┘
                                     │
                                     ▼
              ┌──────────────────────────────────────────────┐
              │  src/lib/mcp/tools/service-documents.ts      │
              │   list_services / get_service_checklist /    │
              │   get_service_document_summaries /           │
              │   get_service_upload_download_url /          │
              │   process_service_upload /                   │
              │   mark_service_upload_reviewed /             │
              │   request_service_upload_reupload            │
              └───────────┬──────────────────────────────────┘
                          │ calls data layer directly (no client injection)
                          ▼
   ┌──────────────────────────────────────────────────────────────┐
   │  src/lib/data/  (service-role client resolved internally)     │
   │                                                              │
   │  services.ts        documents.ts                             │
   │   getServicesForTrip  getSignedServiceDocumentDownloadUrl     │
   │   getServiceChecklistForTrip   └─ getSupabaseAdmin()          │
   │   getServiceDocumentSummariesForTrip                           │
   │   assertServiceUploadMutable (guard)                           │
   │   markUploadProcessed / markUploadReviewed / requestReUpload    │
   └───────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
        Supabase (Postgres RLS + private storage bucket "trip-documents")
```

**Data flow for the two named operations:**

```
Download:
  get_service_checklist ──► returns uploads { filePath, status, url: null }
        │  (cookie-based getSignedDocumentUrl resolves null off-session)
        ▼
  get_service_upload_download_url(path) ──► getSignedServiceDocumentDownloadUrl()
        │                                     └─ getSupabaseAdmin().storage
        │                                          .from("trip-documents")
        │                                          .createSignedUrl(path, 3600)
        ▼
  { url, expiresIn }  ──► client saves bytes locally

Process:
  process_service_upload(tripId, uploadId)
        │
        ├─► assertServiceUploadMutable(uploadId, tripId)   (ownership + archived guard)
        │     └─ getServiceClient() → service role (MCP)
        │        service_uploads(id) → service_id → services → trip_id
        │        (reject missing/cross-trip/archived)
        │
        └─► markUploadProcessed(uploadId)
              └─ storage.remove([file_path]) + update(status="processed", file_removed=true)
```

---

## Architecture Decisions

### Decision: Stateless Streamable-HTTP transport (no sessions, no AsyncLocalStorage)

**Choice**: Use `WebStandardStreamableHTTPServerTransport` from `@modelcontextprotocol/sdk/server/webStandardStreamableHttp` with `sessionIdGenerator: undefined` (stateless mode), built per-request inside `handleMcpRequest`. Drop `supabase-store.ts` (`AsyncLocalStorage`, `getMcpSupabaseClient`, `runWithMcpSupabase`).

**Alternatives considered**: (a) Stateful transport with `sessionIdGenerator` + an in-memory session map; (b) SSE transport; (c) porting the old AsyncLocalStorage `supabase-store.ts`.

**Rationale**: A machine-to-machine agent makes independent, stateless calls; there is no browser session to persist. Stateless mode avoids server-side session bookkeeping and its memory/lifecycle concerns on serverless Node runtimes. The old `supabase-store.ts` existed solely to propagate a trailing `supabase` client argument through the call stack; main's data layer no longer accepts that argument (`getServiceClient()`/`getSupabaseAdmin()` resolve the client internally), so the AsyncLocalStorage is dead weight. Verified against SDK 1.30.0: `sessionIdGenerator?: () => string` is documented "If not provided, session management is disabled (stateless mode)".

### Decision: Timing-safe Bearer allow-list for auth (401)

**Choice**: Port `src/lib/mcp/auth.ts` verbatim. `validateMcpApiKey(authHeader)` splits a comma-separated `MCP_API_KEY` allow-list, requires `Bearer <token>`, and compares each candidate key with `crypto.timingSafeEqual` (length-checked). Reject with `401 { error: "Unauthorized" }` before any tool registration.

**Alternatives considered**: (a) Session/cookie auth via Supabase (`requireRole`) — rejected because MCP is machine-to-machine with no browser session; (b) plain `===` string comparison — rejected (timing side-channel).

**Rationale**: The agent authenticates with a shared secret; a timing-safe allow-list supports key rotation (comma-separated) without redeploys and closes the classic timing oracle. Ported verbatim because it is pure (only `MCP_API_KEY` env + `node:crypto`), proven, and already tested on the old branch.

### Decision: Service-role availability gate (503) — no silent mock fallback

**Choice**: `canUseServiceRole()` (from `@/lib/data/shared`) is evaluated per request in `route.ts`; when false, return `503 { error: "MCP server requires Supabase service role" }` **before** constructing the server or dispatching any tool.

**Alternatives considered**: (a) Allowing the data layer's mock branches (`!isSupabaseConfigured()` paths) to serve in-memory data — rejected; (b) allowing the anon/cookie client to serve read tools — rejected (private bucket + RLS `auth.uid() is not null` deny off-session).

**Rationale**: `getServiceClient()` prefers `getSupabaseAdmin()` only when `SUPABASE_SERVICE_ROLE_KEY` is set; otherwise it falls back to a cookie-based client (denied off-session) or throws. Gating on `canUseServiceRole()` guarantees tools always run against real Supabase via the service role and never against throwaway mock data. This is the "no mock from MCP" decision carried from the prior change. The route must never emit a 500/200 that hides a missing service role.

### Decision: No client injection — tools call `data.fn()` directly

**Choice**: Tool handlers import and call the data-layer functions with their **natural signatures** (no trailing `supabase` argument, no `getMcpSupabaseClient()`). Read tools call `getServicesForTrip`, `getServiceChecklistForTrip`, `getServiceDocumentSummariesForTrip`; mutation tools call the guard + `markUploadProcessed`/`markUploadReviewed`/`requestReUpload`.

**Alternatives considered**: (a) Porting `supabase-store.ts` + trailing injection (old approach) — rejected; (b) adding an optional `client` parameter to data functions — rejected (broad signature churn across the data layer).

**Rationale**: The internal `getServiceClient()` already resolves `getSupabaseAdmin()` whenever the service role is configured, which is exactly the MCP context (guaranteed by the 503 gate). Adding a client parameter would duplicate resolution logic and diverge from main's modular data-layer convention.

### Decision: Service-role signed-URL helper (not cookie-based)

**Choice**: New `getSignedServiceDocumentDownloadUrl(path: string, expiresIn = 3600): Promise<string>` in `src/lib/data/documents.ts`, implemented with `getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresIn)`. Keep `getSignedDocumentUrl` unchanged.

**Alternatives considered**: (a) Reuse `getSignedDocumentUrl` — rejected: it builds a cookie/anon client via `createServerSupabase()` and returns `null` from a cookie-less MCP route (verified in exploration §3); (b) add an optional `asAdmin`/`client` param to `getSignedDocumentUrl` — rejected (churns an existing widely-used function and its call sites for no benefit).

**Rationale**: Service-role-signed URLs are valid download tokens regardless of signing key, and bypass the private bucket's `auth.uid() is not null` storage policy and the `service_uploads`/`services` RLS. A dedicated function keeps the change additive and avoids touching the cookie path used by the dashboard. `getSupabaseAdmin()` is memoized and already imported-safe (no `cookies()` dependency).

### Decision: Data-layer ownership/archived-trip guard

**Choice**: New `assertServiceUploadMutable(uploadId: string, tripId: string): Promise<void>` in `src/lib/data/services.ts`. It uses `getServiceClient()` (service role in MCP) to:

1. Load `service_uploads` by `id` → `service_id`; throw `Error("Upload no encontrado")` if absent.
2. Load `services` by that `service_id` → `trip_id`; throw `Error("Servicio no encontrado")` if absent.
3. Throw `Error("Upload no encontrado")` if `trip_id !== tripId` (ownership mismatch is mapped to NOT_FOUND to avoid cross-trip existence disclosure).
4. Load `trips` by `trip_id` → `status`; throw `Error("El viaje archivado es de solo lectura")` if `status === "archived"`.

The three mutation tools call this **before** mutating.

**Alternatives considered**: (a) Reuse the Server-Action guards `assertServiceDocumentMutableTrip` / `getUploadForTrip` — rejected: they depend on `requireRole("admin","agent")` (cookie session) and `revalidatePath`, and are not importable from a cookie-less route; (b) resolve the trip via `getTripById` — rejected: `getTripById` uses `createServerSupabase()` (cookie/anon) and would be RLS-denied off-session; the guard must query `trips.status` through the service-role client.

**Rationale**: `markUploadProcessed`/`markUploadReviewed`/`requestReUpload` update by upload id with **no** trip-status or ownership check — those invariants live only in the Server Actions and are required by the `service-upload-review` spec ("Archived trips MUST reject this mutation"). The data-layer helper re-implements the exact Server-Action checks (`no pertenece` + `archivado`) without the cookie/`requireRole` dependency, and is a clean candidate for later reuse by the dashboard actions to deduplicate the two guard sites. It has **no mock branch** by design: the MCP route's 503 gate guarantees Supabase is configured before any tool runs.

### Decision: SDK pin `@modelcontextprotocol/sdk@1.30.0`, zod `^4` already satisfied

**Choice**: Add `@modelcontextprotocol/sdk@1.30.0` (exact). No zod change.

**Alternatives considered**: (a) Latest SDK (unpinned) — rejected (drift risk, the old branch proved 1.30.0 works); (b) bumping zod — rejected.

**Rationale**: Verified against the registry: SDK 1.30.0 declares `peerDependencies.zod = "^3.25 || ^4.0"` (required) and `@cfworker/json-schema` (optional). Existing `zod@^4.4.3` satisfies the peer. Import subpaths verified: `@modelcontextprotocol/sdk/server/mcp` (`McpServer`), `@modelcontextprotocol/sdk/server/webStandardStreamableHttp` (`WebStandardStreamableHTTPServerTransport`), `@modelcontextprotocol/sdk/types.js` (`CallToolResult`).

---

## Tool → Data-Function Mapping

The seven tools are registered in `src/lib/mcp/tools/service-documents.ts` via `server.tool(name, description, zodSchema, handler)`.

| # | Tool | Wraps (data layer) | Zod input shape | Output | Guard |
|---|------|--------------------|-----------------|--------|-------|
| 1 | `list_services` | `getServicesForTrip(tripId)` | `{ tripId: z.string().min(1) }` | `Service[]` | — |
| 2 | `get_service_checklist` | `getServiceChecklistForTrip(tripId, serviceId)` | `{ tripId: z.string().min(1), serviceId: z.string().min(1) }` | `ServiceWithChecklist` (uploads with `filePath`/`status`; `url` fields `null`) | — |
| 3 | `get_service_document_summaries` | `getServiceDocumentSummariesForTrip(tripId)` | `{ tripId: z.string().min(1) }` | `ServiceDocumentSummary[]` | — |
| 4 | `get_service_upload_download_url` | **new** `getSignedServiceDocumentDownloadUrl(path, expiresIn?)` | `{ path: z.string().min(1), expiresIn: z.number().int().min(60).max(604800).optional() }` | `{ url: string, expiresIn: number }` | — |
| 5 | `process_service_upload` | `markUploadProcessed(uploadId)` | `{ tripId: z.string().min(1), uploadId: z.string().min(1) }` | `{ processed: true }` | `assertServiceUploadMutable` |
| 6 | `mark_service_upload_reviewed` | `markUploadReviewed(uploadId)` | `{ tripId: z.string().min(1), uploadId: z.string().min(1) }` | `{ reviewed: true }` | `assertServiceUploadMutable` |
| 7 | `request_service_upload_reupload` | `requestReUpload(uploadId, comment)` | `{ tripId: z.string().min(1), uploadId: z.string().min(1), comment: z.string().min(1) }` | `{ reuploadRequested: true }` | `assertServiceUploadMutable` |

**Note on `get_service_checklist`** (tool #2): `getServiceChecklistForTrip` → `getServiceWithChecklist` performs the *query* via `getServiceClient()` (service role in MCP — succeeds) but calls `getSignedDocumentUrl` (cookie/anon) for each upload's `url`, which resolves to `null` off-session. The tool therefore returns uploads with `filePath`/`status` and `url: null`, and the client fetches a real signed URL on demand via tool #4 with the `filePath`. This matches the proposal's "no signed URLs embedded" decision. The N cookie-signing calls that return `null` are a minor accepted inefficiency; if payload or latency matters, the tool can map its output to strip `url` fields (documented as an optional follow-up, not required for correctness).

---

## Error-Mapping Strategy

Invalid input, not-found, and unexpected conditions are mapped to a structured, secret-safe result envelope. **No stack traces, service-role key, SQL, or internal storage paths may ever appear in a tool result.**

| Condition | Detection | Result envelope |
|-----------|-----------|-----------------|
| Invalid input (zod schema fails) | MCP SDK zod validation rejects before handler runs | SDK parse rejection (`-32602`) — no custom code |
| Upload missing | guard throws `Error("Upload no encontrado")` | `notFound("upload", uploadId)` → text `NOT_FOUND: upload {id}`, `isError: true` |
| Service missing | guard throws `Error("Servicio no encontrado")` | `notFound("service", serviceId)` |
| Ownership mismatch (cross-trip) | guard throws `Error("Upload no encontrado")` | `notFound("upload", uploadId)` (existence-safe) |
| Archived trip | guard throws `Error("El viaje archivado es de solo lectura")` | `mcpError("El viaje archivado es de solo lectura")`, `isError: true` |
| Unexpected (storage/RLS/network) | any other thrown error | `unexpectedError(err)` → `mcpError("An unexpected error occurred")` |

**Plumbing (ported verbatim, unchanged):**

- `src/lib/mcp/errors.ts`: `notFound(resource, id)`, `mcpError(message)`, `success(content)`.
- `src/lib/mcp/tools/utils.ts`: `textResult(value)`, `safeMessage(err)`, `isNotFoundMessage(msg)` (matches `"no encontrado"` / `"not found"`), `unexpectedError(err)` (never leaks stack/secrets).

**Tool-layer guard mapping** (new, in `service-documents.ts` only — keeps the ported files untouched):

```ts
function guardFailure(err: unknown, resource: string, id: string): CallToolResult {
  const message = safeMessage(err);
  if (message.includes("no encontrado") || message.includes("no pertenece")) {
    return notFound(resource, id);
  }
  if (message.includes("archivado")) {
    return mcpError("El viaje archivado es de solo lectura");
  }
  return unexpectedError(err);
}
```

Read tools (#1–#4) wrap their calls in `try/catch` returning `unexpectedError(err)`; mutation tools (#5–#7) use `guardFailure` for guard rejections and `unexpectedError` for the mutation itself. The guard intentionally uses `"Upload no encontrado"` for **both** a missing upload and a cross-trip upload so callers cannot probe which trips own which uploads.

---

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add `@modelcontextprotocol/sdk@1.30.0` (exact) to `dependencies`. |
| `src/app/api/mcp/route.ts` | Create | `runtime = "nodejs"`; `handleMcpRequest` with `validateMcpApiKey` (401) → `canUseServiceRole()` (503) → `createMcpServer()` + stateless `WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined })`; exports `POST`/`GET`/`DELETE`. |
| `src/lib/mcp/auth.ts` | Create | Timing-safe Bearer allow-list (`isMcpApiKeyConfigured`, `validateMcpApiKey`) — ported verbatim. |
| `src/lib/mcp/errors.ts` | Create | `notFound`/`mcpError`/`success` result envelope — ported verbatim. |
| `src/lib/mcp/tools/utils.ts` | Create | `textResult`/`safeMessage`/`isNotFoundMessage`/`unexpectedError` — ported verbatim. |
| `src/lib/mcp/server.ts` | Create | `createMcpServer()` → `new McpServer({ name: "travelhub-mcp", version: "1.0.0" })`, registers only `registerServiceDocumentTools`. |
| `src/lib/mcp/tools/service-documents.ts` | Create | Seven tool registrars (zod schemas) + `guardFailure` helper. |
| `src/lib/data/documents.ts` | Modify | Add `getSignedServiceDocumentDownloadUrl(path, expiresIn?)` using `getSupabaseAdmin()`; add `import { getSupabaseAdmin } from "@/lib/supabase/server"`. |
| `src/lib/data/services.ts` | Modify | Add `assertServiceUploadMutable(uploadId, tripId)` guard helper (queries `service_uploads` → `services` → `trips` via `getServiceClient()`). |
| `src/lib/mcp/__tests__/auth.test.ts` | Create | Timing-safe allow-list unit tests. |
| `src/app/api/mcp/__tests__/route.test.ts` | Create | 401 / 503 gate tests. |
| `src/app/api/mcp/__tests__/route-tools.test.ts` | Create | Tool wiring + error mapping tests. |
| `src/lib/data/__tests__/documents.test.ts` | Create | Signed-URL helper tests (service role path). |
| `src/lib/data/__tests__/services.test.ts` | Modify/Create | Guard tests (missing/cross-trip/archived). |

---

## Interfaces / Contracts

**New: `getSignedServiceDocumentDownloadUrl`** (`src/lib/data/documents.ts`):

```ts
import { getSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Genera una URL firmada de corta duración para descargar un documento de
 * servicio usando el service-role (bypasea el bucket privado y RLS). Lanza si
 * no hay service role o si el firmado falla; el tool MCP lo mapea a un error seguro.
 */
export async function getSignedServiceDocumentDownloadUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
```

**New: `assertServiceUploadMutable`** (`src/lib/data/services.ts`):

```ts
/**
 * Guard de ownership + lifecycle para mutaciones de uploads vía MCP.
 * Verifica que el upload exista, pertenezca a `tripId` (vía service→trip_id)
 * y que el viaje no esté archivado. Sin rama mock: el route MCP exige service role.
 */
export async function assertServiceUploadMutable(
  uploadId: string,
  tripId: string
): Promise<void> {
  const supabase = await getServiceClient();

  const { data: uploadRow, error: uploadError } = await supabase
    .from("service_uploads")
    .select("service_id")
    .eq("id", uploadId)
    .maybeSingle();
  if (uploadError) throw uploadError;
  if (!uploadRow) throw new Error("Upload no encontrado");

  const { data: serviceRow, error: serviceError } = await supabase
    .from("services")
    .select("trip_id")
    .eq("id", uploadRow.service_id as string)
    .maybeSingle();
  if (serviceError) throw serviceError;
  if (!serviceRow) throw new Error("Servicio no encontrado");

  if ((serviceRow.trip_id as string) !== tripId) {
    // Ownership mismatch → misma señal que "no encontrado" (no filtrar existencia).
    throw new Error("Upload no encontrado");
  }

  const { data: tripRow, error: tripError } = await supabase
    .from("trips")
    .select("status")
    .eq("id", tripId)
    .maybeSingle();
  if (tripError) throw tripError;
  if (tripRow?.status === "archived") {
    throw new Error("El viaje archivado es de solo lectura");
  }
}
```

**Route contract** (`src/app/api/mcp/route.ts`):

- `export const runtime = "nodejs"` (Route Handler must run on Node, not Edge — the SDK transport and `node:crypto` require it).
- `GET`/`POST`/`DELETE` all delegate to `handleMcpRequest`.
- 401 body: `{ "error": "Unauthorized" }`.
- 503 body: `{ "error": "MCP server requires Supabase service role" }`.

**Transport options (verified against SDK 1.30.0):** `sessionIdGenerator: undefined` (stateless), `enableJsonResponse: true`.

---

## Testing Strategy

Strict TDD is enabled (`openspec/config.yaml` `testing.strict_tdd: true`, `apply.tdd: true`): each mapped test is written as a RED test before the production change, then made GREEN, then REFACTORED.

| Layer | What to Test | Approach |
|-------|--------------|----------|
| Unit — auth | `validateMcpApiKey`: no header → false; wrong scheme → false; wrong token → false; valid single key → true; valid second key in comma list → true; malformed header → false | Vitest; no Supabase needed (pure function) |
| Unit — signed URL | `getSignedServiceDocumentDownloadUrl` calls `getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresIn)` with default 3600 and overridden expiry; rethrows storage error | Vitest with mocked `@/lib/supabase/server` + `@supabase/supabase-js` |
| Unit — guard | `assertServiceUploadMutable`: missing upload → `"Upload no encontrado"`; missing service → `"Servicio no encontrado"`; cross-trip → `"Upload no encontrado"`; archived → `"El viaje archivado es de solo lectura"`; happy path resolves | Vitest with mocked `getServiceClient()` query chain |
| Integration — route gate | `handleMcpRequest` returns 401 without/with-invalid Bearer; returns 503 when `canUseServiceRole()` false; constructs transport when both pass | Vitest with mocked env + data layer |
| Integration — tool wiring | Each of 7 tools is registered and dispatches to the expected data function; mutation tools invoke the guard first; invalid zod input is rejected by the SDK | Vitest (tool handler invocation) |
| Build | `npx tsc --noEmit` and `npm run build` | Confirm `nodejs` runtime + SDK subpath typecheck |
| Optional smoke | Live `curl` against `/api/mcp` with a real `MCP_API_KEY` + service role | Manual; optional, not a gate |

**Commands** (from `openspec/config.yaml`): `npx tsc --noEmit`, `npm run test` (Vitest), `npm run build`. A smoke script is optional and not part of the gate.

---

## Threat Matrix

The design adds an HTTP API route with a Bearer auth gate, but introduces **no** shell commands, subprocesses, VCS/PR automation, or executable-file classification. None of the five matrix boundaries apply; the matrix is recorded as **not applicable** rather than expanded.

| Boundary | Applicability | Reason |
|---|---|---|
| Documentation-like paths | N/A | No file classification or execution of filesystem/executable content; the MCP tools operate on Supabase storage paths read from DB rows. |
| Git repository selection | N/A | No `git`/`-C` invocation; the change performs no repository mutation. |
| Commit state | N/A | No `git commit` surface. |
| Push state | N/A | No `git push` surface. |
| PR commands | N/A | No PR/composed-command automation. |

The adversarial surface this change *does* add is handled by the auth/service-role gates and secret-safe error envelope documented above (not the VCS/PR matrix).

---

## Migration / Rollout

**No database migration, no data conversion, no feature flags.** Rollback is a single work-unit commit reverting: `package.json` (remove the SDK dependency), `src/app/api/mcp/route.ts` + `src/lib/mcp/**` (remove), and the two additive data-layer functions (`getSignedServiceDocumentDownloadUrl`, `assertServiceUploadMutable` — additive and unused by the UI). Removing the route and dependency fully restores prior behavior.

**Deployment prerequisite:** `MCP_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must be present in the deployed environment. Without the service-role key the route returns 503 (fail-safe, no silent mock).

---

## Open Questions

- [ ] None blocking. The two resolved open questions from the proposal (signed-URL helper shape, guard helper shape) are finalized above. One optional follow-up is noted: stripping `url: null` fields from `get_service_checklist` output to reduce payload/latency.

---

## Risks / Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Service role missing at deploy → tools unreachable | Medium | 503 gate via `canUseServiceRole()`; no silent mock fallback from MCP (success criterion). |
| Guard drift vs Server Actions (archived/ownership) | Medium | Single data-layer `assertServiceUploadMutable` mirrors the exact Server-Action checks; RED tests cover missing/cross-trip/archived; documented as a future dedup candidate. |
| Signed-URL helper signs arbitrary bucket paths | Low | `path` is supplied only from the checklist `filePath`; the `MCP_API_KEY` holder is already a trusted agent; service-role is gated. |
| SDK/zod peer mismatch | Low | Pin `@modelcontextprotocol/sdk@1.30.0`; existing `zod@^4.4.3` satisfies the `^3.25 || ^4.0` peer (verified). |
| Old-route name mismatch (`isServiceRoleConfigured`/`createServiceRoleClient`) | Low | Ported route renamed to `canUseServiceRole()`; `createServiceRoleClient`/`runWithMcpSupabase` dropped entirely. |
| `getTripById` is cookie-bound (would break guard off-session) | Medium | Guard queries `trips.status` directly via `getServiceClient()`, never `getTripById` (documented as Decision). |
| `get_service_checklist` performs N null-returning cookie signing calls | Low | Accepted inefficiency; optional follow-up to strip `url` fields (not correctness-critical). |

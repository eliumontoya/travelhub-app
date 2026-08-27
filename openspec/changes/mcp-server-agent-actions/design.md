# Design: MCP Server for Agent Actions

## Technical Approach

Add an MCP (Model Context Protocol) server as a Next.js Route Handler at
`src/app/api/mcp/route.ts`, speaking Streamable HTTP via the official
`@modelcontextprotocol/sdk`. Requests are gated by a dedicated `MCP_API_KEY`
Bearer check, then dispatched to ~41 tools. Each tool wraps an existing
`src/lib/data.ts` function, but instead of the cookie-aware anon client the
handler injects a **service-role** Supabase client so RLS is bypassed without a
browser session. The dashboard, `/t/[slug]`, and existing `/api/*` routes are
untouched.

## Architecture Overview

```text
MCP client (@modelcontextprotocol/client + HttpClientTransport)
   │  POST /api/mcp   Authorization: Bearer <MCP_API_KEY>
   ▼
src/app/api/mcp/route.ts
   │ 1. runtime = "nodejs"
   │ 2. AUTH GATE: validate MCP_API_KEY (timing-safe, comma allow-list) → 401 if bad
   │ 3. SUPABASE CHECK: isSupabaseConfigured()/service-role key present → 503 if not
   │ 4. build McpServer + WebStandardStreamableHTTPServerTransport (stateless)
   │ 5. transport.handle(request)  ── dispatches JSON-RPC ──┐
   ▼                                                        │
src/lib/mcp/tools/*  (tool definitions)                      │
   │ each tool: validate Zod input → call data.ts fn         │
   ▼                                                        │
src/lib/data.ts  (functions accept optional injected client) │
   │  injected = createServiceRoleClient()  ◀── bypasses RLS │
   ▼                                                        │
Supabase (Postgres + Storage)  ◀─────────────────────────────┘
```

The MCP path is **stateless**: `WebStandardStreamableHTTPServerTransport` is
constructed with `sessionIdGenerator: undefined`, so no server-side session
store is needed (fits Vercel serverless; each request is a fresh invocation).

## Architecture Decisions

### Decision: SDK package & version
**Choice**: `@modelcontextprotocol/sdk@1.30.0` (pinned exact), imported via its
subpaths: `McpServer` from `@modelcontextprotocol/sdk/server/mcp`,
`WebStandardStreamableHTTPServerTransport` from
`@modelcontextprotocol/sdk/server/streamableHttp`, and `HttpClientTransport`
from `@modelcontextprotocol/sdk/client/streamableHttp`.
**Alternatives**: the legacy standalone `@modelcontextprotocol/server` package
(the brief's assumption) is deprecated; `@modelcontextprotocol/sdk/server` is
the current home of both `McpServer` and the web-standard transport.
**Rationale**: Single maintained package, current Streamable HTTP API, and its
`zod` peer range (`^3.25 || ^4.0`) is satisfied by the project's existing
`zod@^4.4.3`. Exact pin avoids transport API drift (a stated risk).

### Decision: Stateless Streamable HTTP transport
**Choice**: `WebStandardStreamableHTTPServerTransport` with
`sessionIdGenerator: undefined` (stateless mode) + `export const runtime = "nodejs"`.
**Alternatives**: stateful session mode (needs a session store) or Edge runtime.
**Rationale**: Vercel functions are ephemeral; stateless avoids DB/store
coupling. Node runtime is required because the SDK and `crypto.randomUUID()`
are not guaranteed on Edge, and `@supabase/ssr`/`@supabase/supabase-js` target
Node. Next.js 16 `runtime` doc confirms `'nodejs'` is the valid segment config.

### Decision: Auth gate placement & shape
**Choice**: Gate runs **before** `transport.handle()`, inside the `POST` handler.
Bearer token validated with `crypto.timingSafeEqual` against a
comma-separated allow-list from `MCP_API_KEY` (enables zero-downtime rotation:
old+new coexist briefly). Missing/malformed/non-matching → `401` JSON, no tool
ever dispatched.
**Rationale**: Fail-closed at the edge; the service-role client is never built
for unauthorized callers. Comma allow-list satisfies the proposal's rotation
open question.

### Decision: Data-layer injection (the critical coupling)
**Choice**: Add `createServiceRoleClient()` to `src/lib/supabase/server.ts`
using `SUPABASE_SERVICE_ROLE_KEY` via the **plain** `createClient` from
`@supabase/supabase-js` (not the SSR cookie client) with
`auth: { autoRefreshToken: false, persistSession: false }`. Every `data.ts`
function invoked by an MCP tool gains an **optional trailing parameter**
`supabase?: SupabaseClient`. Internal mock fallback is guarded so it only runs
when `!supabase && !isSupabaseConfigured()` — an injected service-role client
therefore never falls into mock mode.
**Alternatives**: duplicating `data.ts` for MCP, or always reading env inside
each tool.
**Rationale**: Reuses the single source of truth with no behavioral change for
existing dashboard/server-action callers (they omit the param → today's anon
client + mock behavior preserved). Mock path is unreachable from MCP by
construction, satisfying the "no mock from MCP" requirement.

### Decision: Error-mapping strategy (unified)
**Choice**:
- **Invalid input** → rejected by the tool's Zod v4 schema *before* `data.ts`
  runs (SDK returns a validation error automatically).
- **Not found** → tool catches the `null`/not-found signal from `data.ts` and
  returns `{ content: [{ type: "text", text: "NOT_FOUND: <resource> <id>" }], isError: true }`.
- **Unexpected / constraint** (e.g. supplier referenced, missing date range) →
  tool returns `{ content: [{ type: "text", text: "<safe message>" }], isError: true }`.
  The `SUPABASE_SERVICE_ROLE_KEY` and raw stack traces are **never** included.
**Rationale**: Structured, machine-readable tool errors; no secret/stack leakage.

## Data Flow (per request)

1. `POST /api/mcp` → handler checks `runtime` (nodejs), runs auth gate, checks Supabase config.
2. Build one `McpServer`, register all tools once (module-level singleton reused across warm invocations).
3. `transport.handle(request)` parses JSON-RPC; for a `tools/call`, the matching tool:
   - validates args via Zod,
   - calls the wrapped `data.ts` fn passing the injected service-role client,
   - maps the result/error to the MCP content shape.
4. Handler returns the transport's `Response` (Streamable HTTP compliant).

## Tool Layer

Each tool is registered with `server.tool(name, description, zodShape, handler)`.
Zod v4 schemas reuse the same idiom as `src/lib/item-metadata-schemas.ts`
(`z.object({...})` with `.min(1)` on required arrays, enums for `status`/
`currency`/`type`). Representative skeletons:

```ts
// READ
server.tool("get_client",
  "Fetch a client by id",
  { id: z.string().min(1) },
  async ({ id }, extra) => {
    const client = await getClientById(id, extra.supabase);
    if (!client) return notFound("client", id);
    return { content: [{ type: "text", text: JSON.stringify(client) }] };
  });
```

```ts
// CREATE
server.tool("create_supplier",
  "Create a supplier",
  { name: z.string().min(1), type: z.string().min(1),
    contactEmail: z.string().email().optional(), tags: z.array(z.string()).optional() },
  async (args, extra) => {
    const supplier = await createSupplier(args, extra.supabase);
    return { content: [{ type: "text", text: JSON.stringify(supplier) }] };
  });
```

```ts
// UPDATE
server.tool("update_trip",
  "Edit trip metadata and status (draft|published|archived)",
  { id: z.string().min(1), status: z.enum(["draft","published","archived"]).optional(),
    salePrice: z.number().nullable().optional(), commissionRate: z.number().nullable().optional() },
  async ({ id, ...rest }, extra) => {
    const trip = await updateTrip(id, rest, extra.supabase);
    if (!trip) return notFound("trip", id);
    return { content: [{ type: "text", text: JSON.stringify(trip) }] };
  });
```

`extra.supabase` is the injected service-role client, attached by a thin adapter
that wraps every handler so tool code stays declarative. All ~41 MVP tools
follow this pattern (clients 7, suppliers 6, trips 9, trip-days 6, items 7,
packing 3, internal-notes 2, `get_document_upload_url` 1 → 41).

## Document Access

`get_document_upload_url` returns a short-lived **PUT** pre-signed URL. The
existing `getSignedDocumentUrl(path)` produces a *download* URL
(`createSignedUrl`), so it is **not** reused. A new helper
`getSignedDocumentUploadUrl(path, expiresIn = 300)` is added to `data.ts`
(accepting the optional `supabase?` param) and calls
`supabase.storage.from(DOCUMENTS_BUCKET).createSignedUploadUrl(path, expiresIn)`.
The agent PUTs bytes directly to Supabase Storage; binary upload `upload_*`
tools remain deferred.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/mcp/route.ts` | Create | Route Handler: nodejs runtime, auth gate, Supabase check, transport wiring, `McpServer` build + `server.tool(...)` registrations (or delegates to `src/lib/mcp/`). |
| `src/lib/mcp/server.ts` | Create | Builds/configures the `McpServer` singleton and registers all tool modules. |
| `src/lib/mcp/tools/*.ts` | Create | One module per domain (clients, suppliers, trips, tripDays, items, packing, internalNotes, documents) exporting a `registerXxxTools(server, deps)` fn. |
| `src/lib/mcp/auth.ts` | Create | `MCP_API_KEY` allow-list validation (timing-safe) + 401 helper. |
| `src/lib/mcp/errors.ts` | Create | `notFound()` / generic error → MCP content mappers. |
| `src/lib/supabase/server.ts` | Modify | Add `createServiceRoleClient()` + `isServiceRoleConfigured()`. |
| `src/lib/data.ts` | Modify | Append optional `supabase?: SupabaseClient` to every MCP-called function; guard mock branch with `!supabase`; add `getSignedDocumentUploadUrl(path, expiresIn?)`. |
| `src/types/` (no change) | — | Reuse existing domain types for result serialization. |
| `SUPABASE_SETUP.md` / README | Modify | Document `MCP_API_KEY`, endpoint URL, rotation, sample `HttpClientTransport` client snippet. |

No changes to `/t/[slug]`, `/c/[slug]`, dashboard, Server Actions, RLS,
`/api/cron/*`, or `/api/flight-status`.

## Interfaces / Contracts

```ts
// src/lib/supabase/server.ts (added)
export function isServiceRoleConfigured(): boolean;
export function createServiceRoleClient(): SupabaseClient; // plain supabase-js, no RLS

// data.ts — every MCP-wrapped fn gains a trailing optional param:
export async function getClientById(id: string, supabase?: SupabaseClient): Promise<Client | null>;
export async function createSupplier(input: CreateSupplierInput, supabase?: SupabaseClient): Promise<Supplier>;
export async function updateTrip(id: string, input: UpdateTripInput, supabase?: SupabaseClient): Promise<Trip>;
// ... same shape for all ~41 functions.

export async function getSignedDocumentUploadUrl(path: string, expiresIn?: number, supabase?: SupabaseClient): Promise<string | null>;

// tool handler adapter injects the client:
type ToolExtra = { supabase: SupabaseClient };
```

## Testing & Verification Plan

The project **does** have a test runner (`vitest` in devDependencies, `npm test`).
Plan:

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Type | `npx tsc --noEmit` + `npm run build` clean | CI gate; catch transport/SDK type drift. |
| Unit | `createServiceRoleClient()` builds with service key; mock branch unreachable when `supabase` injected; `getSignedDocumentUploadUrl` calls `createSignedUploadUrl`. | `vitest` (e.g. `src/lib/mcp/__tests__/`). |
| Unit | Auth gate: valid key accepted, bad/missing → 401, allow-list rotation. | `vitest` with mocked `request`. |
| Integration | Each tool maps not-found → `isError`, invalid input → SDK rejection, success → JSON payload. | `vitest` + mocked `data.ts` fns. |
| E2E smoke | Real MCP client opens session, `listTools()`, calls `list_clients`/`create_client` against a configured Supabase (or a throwaway project). | Script using `@modelcontextprotocol/sdk` `HttpClientTransport`; run locally + one Vercel preview deploy. |

Manual fallback (if CI Supabase unavailable): type-check + build + mocked unit
tests suffice; full E2E requires a configured Supabase and is run pre-merge.

## Threat Matrix

`N/A` — no routing/shell/subprocess/VCS/PR/executable-file/process-integration
boundary is introduced. The only new HTTP surface is `/api/mcp`, gated by
`MCP_API_KEY` (fail-closed 401) and Node runtime. (Standard auth/secret
handling is covered under Risks.)

## Migration / Rollout

No data migration. Add `MCP_API_KEY` as a **sensitive** Vercel env var (and
`.env.local` for dev). `SUPABASE_SERVICE_ROLE_KEY` already exists. Deploy is the
normal Vercel push-to-`main`; new surface is additive and inert until a client
presents a valid key.

## Open Questions (resolved by this design)

- Rotation → comma-separated `MCP_API_KEY` allow-list. ✔
- Status transitions → single `update_trip` with `status` enum. ✔ (per trip-tools spec)
- Document upload → pre-signed PUT URL only; binary `upload_*` deferred. ✔

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Service-role key exposure | Server-only import; never returned in results/errors; Vercel "sensitive" flag; no key logging. |
| Single-key blast radius | Treat `MCP_API_KEY` like the service key; document agent = admin equivalence; fine-grained scopes deferred. |
| Vercel function timeout (10s/60s) | Tools are single-shot/bounded; stateless transport; no long sessions. |
| SDK API drift | Exact pin `1.30.0`; all registration logic isolated in `src/lib/mcp/*` so an upgrade touches one module. |
| Cold-start + init latency | Module-level `McpServer` singleton reused across warm invocations; cheap per-request init. |
| `data.ts` client coupling / mock fallback | Trailing `supabase?` param + mock guard ensures MCP always uses service role, never mock. |
| Next 16 + SDK + Node compatibility | `runtime = "nodejs"`; verified via build + E2E smoke test. |

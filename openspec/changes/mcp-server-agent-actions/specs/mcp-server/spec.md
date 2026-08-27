# Delta for MCP Server

## ADDED Requirements

### Requirement: MCP server transport and runtime

The system SHALL expose an MCP (Model Context Protocol) server at the Route Handler `src/app/api/mcp/route.ts`, mounted at `POST /api/mcp`, speaking **Streamable HTTP** via the official `@modelcontextprotocol/server` TypeScript SDK (`WebStandardStreamableHTTPServerTransport`). The route SHALL declare `export const runtime = "nodejs"` (not Edge) so the SDK and `crypto.randomUUID()` are available. An MCP client built on `@modelcontextprotocol/client` with `HttpClientTransport` SHALL be able to open a session and call tools against this endpoint.

#### Scenario: Client opens a session and lists tools

- GIVEN a deployed TravelHub with the MCP route enabled
- WHEN an MCP client connects to `POST /api/mcp` and calls `listTools()`
- THEN the client receives the MCP `tools/list` result containing the registered tool set

#### Scenario: Route runs on the Node.js runtime

- GIVEN the `/api/mcp` route is requested
- WHEN the handler initializes the Streamable HTTP transport
- THEN it initializes under the Node.js runtime and does not fail due to an Edge-only API

### Requirement: API key authentication

Every request to `/api/mcp` SHALL be authenticated with a dedicated `MCP_API_KEY` passed as `Authorization: Bearer <key>`. Requests without a valid key (missing header, malformed header, or key not matching the configured value) SHALL be rejected with HTTP `401` before any tool is dispatched. Key validation SHALL support a comma-separated allow-list (so a previous and next key can briefly coexist during rotation) at the design's discretion.

#### Scenario: Valid key is accepted

- GIVEN `MCP_API_KEY` is configured and the client sends a matching `Authorization: Bearer` header
- WHEN the client issues an MCP request
- THEN the request is processed and tools are dispatched

#### Scenario: Missing or invalid key is rejected

- GIVEN a request to `/api/mcp` with no `Authorization` header (or a non-matching key)
- WHEN the handler inspects the request
- THEN it responds with HTTP `401` and does not execute any tool

### Requirement: Service-role data access with no mock fallback

The MCP handler SHALL access data through `src/lib/data.ts` using an injected **service-role Supabase client** (`createServiceRoleClient()` from `src/lib/supabase/server.ts`, built with `SUPABASE_SERVICE_ROLE_KEY`), so it bypasses RLS without a browser cookie session. The MCP path SHALL NOT fall back to `src/lib/mock-data.ts` under any circumstance. If Supabase is not configured (`isSupabaseConfigured()` is false) or the service-role key is absent, the handler SHALL return a clear error (HTTP `503` with a message indicating the MCP server requires Supabase) and SHALL NOT operate on in-memory mock data. The `SUPABASE_SERVICE_ROLE_KEY` MUST never be returned in any tool result or error and MUST only be imported in server-only code.

#### Scenario: Supabase configured uses service-role client

- GIVEN Supabase is configured and a valid `MCP_API_KEY` is presented
- WHEN a tool reads or writes data
- THEN the call uses the injected service-role client and bypasses RLS

#### Scenario: Supabase unconfigured returns a clear error

- GIVEN Supabase is not configured
- WHEN any MCP tool is invoked
- THEN the handler returns a `503` error stating the MCP server requires Supabase, and no mock data is used

### Requirement: Native tool discovery

The MCP server SHALL be self-describing: `listTools()` SHALL return, for every tool, its `name`, a human-readable `description`, and an input schema (Zod/Standard Schema, exposed as JSON Schema). This native discovery is the specification for client generation; no separate OpenAPI/Swagger layer is required or produced in this change.

#### Scenario: Tool schema is discoverable at runtime

- GIVEN a connected MCP client
- WHEN it calls `listTools()`
- THEN each returned tool includes a name, description, and input schema describing its fields and required inputs

### Requirement: Internal-field exposure policy

MCP tool results for trips, clients, and suppliers SHALL include agent-only fields — `internalNotes`, `salePrice`, and `commissionRate` — because the MCP agent acts as the human agent's programmatic equivalent and must see what the human sees. These fields SHALL NOT be exposed by the public traveler paths `/t/[slug]` or `/c/[slug]`, and this change MUST NOT alter that public isolation. The public read paths do not call MCP tools, so their behavior is unchanged.

#### Scenario: MCP tools return internal fields

- GIVEN an MCP client calls `get_trip` or `update_trip_internal_notes` for a trip
- WHEN the result is returned
- THEN it includes `internalNotes`, `salePrice`, and `commissionRate` where applicable

#### Scenario: Public view remains isolated

- GIVEN a traveler opens `/t/[slug]` for a published trip
- WHEN the page renders
- THEN it continues to exclude `internalNotes`, `salePrice`, and `commissionRate`, and the MCP change does not alter this

### Requirement: No impact on existing routes and RLS

The MCP server SHALL be additive only. It SHALL NOT modify `/t/[slug]`, `/c/[slug]`, the dashboard UI, existing Server Actions, RLS policies, or the existing `/api/cron/*` and `/api/flight-status` routes. The only new HTTP surface is `/api/mcp`. Public read isolation (published trips only) and existing auth boundaries MUST remain intact.

#### Scenario: Existing API routes are unaffected

- GIVEN the MCP server is deployed
- WHEN a request hits `/api/flight-status` or `/api/cron/trip-reminders`
- THEN those routes behave exactly as before the change

#### Scenario: Public traveler view is unaffected

- GIVEN a published trip exists
- WHEN a visitor opens `/t/[slug]`
- THEN only published data is shown and no MCP-only field leaks

### Requirement: Deferred binary upload tools

The MVP SHALL expose only the pre-signed-URL helper `get_document_upload_url` for document access. Mutating `upload_*` storage tools (client documents, item documents, trip documents, photos, covers) SHALL NOT be part of this change; the agent is expected to upload bytes directly to Supabase Storage using the returned pre-signed URL. An OpenAPI bridge and MCP Prompts/Resources are also deferred.

#### Scenario: Only the pre-signed helper is available

- GIVEN a connected MCP client calls `listTools()`
- WHEN it inspects the tool list
- THEN `get_document_upload_url` is present but no `upload_*` storage tools are registered

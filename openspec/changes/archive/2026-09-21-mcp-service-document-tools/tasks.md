# Tasks: MCP Service-Document Tools

Expose TravelHub's service-document domain through a minimal MCP server: a gated Streamable-HTTP base plus seven service-document tools, two additive data-layer helpers, and Vitest coverage.

Strict TDD is active (`openspec/config.yaml`: `strict_tdd: true`, `apply.tdd: true`; runner `npm run test` → `vitest run`), so each unit ships RED test → GREEN implementation → REFACTOR. Gates: `npx tsc --noEmit`, `npm run test`, `npm run build`.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~750–950 (production ~420–520 across 9 files; tests ~350–440 across 5 files) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (SDK + MCP base + data helpers + base tests) → PR 2 (7 tools + tool-wiring tests) |
| Delivery strategy | auto-chain |
| Chain strategy | pending — team pick; recommend `stacked-to-main` (PR 1 → main, PR 2 → main). If `feature-branch-chain`: PR #1 base = feature/tracker branch, PR #2 base = PR #1 branch; retarget/rebase if a child diff shows parent changes. |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

> Honest-estimate note vs the preflight assumption ("should be under 400"): the seven tool registrars (`src/lib/mcp/tools/service-documents.ts`, ≈ 180–240) plus the ported plumbing (`auth.ts`/`errors.ts`/`tools/utils.ts`, ≈ 110) plus route + data helpers (≈ 130) already put production at the 400 edge, and the five test files add ≈ 350–440. Total is likely 750–950 → **High**. Auto-chain slices; each slice stays ≈ 400. If the team prefers a single PR, that requires an explicit `size:exception` instead of auto-chain.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | SDK pin + gated MCP base (401/503) + 2 data-layer helpers, all tested | PR 1 | `npx vitest run src/lib/mcp src/app/api/mcp/__tests__/route.test.ts src/lib/data/__tests__/documents.test.ts src/lib/data/__tests__/services.test.ts` | `npx tsc --noEmit && npm run build` (real build proves the nodejs route + SDK subpaths compile); optional manual `curl` 401/503 smoke (non-gate) | Revert `package.json` SDK line + `src/app/api/mcp/**` + `src/lib/mcp/**` + both data-layer helpers; all additive, UI untouched |
| 2 | The 7 service-document tools (zod schemas + `guardFailure` error mapping) | PR 2 | `npx vitest run src/app/api/mcp/__tests__/route-tools.test.ts` | `npx tsc --noEmit && npm run build`; optional live `tools/list` smoke (non-gate) | Revert `src/lib/mcp/tools/service-documents.ts` + the `registerServiceDocumentTools` call in `src/lib/mcp/server.ts` + the route-tools test; route stays 401/503-gated with an empty registry |

## Phase 1: SDK + MCP Base

Goal: a green, gated MCP HTTP base on main with the SDK pinned and the ported plumbing. Fully additive; rollback-safe.

- [x] 1.1 **RED** — Write `src/lib/mcp/__tests__/auth.test.ts` for `validateMcpApiKey`: no header → false; wrong scheme → false; wrong token → false; valid single key → true; valid second key in comma-separated list → true; malformed header → false; `isMcpApiKeyConfigured` false when env unset. Verify: `npx vitest run src/lib/mcp/__tests__/auth.test.ts` fails (module missing). Rollback: delete the test file.
- [x] 1.2 **GREEN** — Create `src/lib/mcp/auth.ts`: timing-safe Bearer allow-list (`crypto.timingSafeEqual`, length-checked) with `isMcpApiKeyConfigured` + `validateMcpApiKey`. Port verbatim from `feat/mcp-server-agent-actions:src/lib/mcp/auth.ts` (read-only); if that branch is unavailable, implement to the contract in design.md (§Architecture Decisions, §Interfaces). Verify: 1.1 suite passes. Rollback: revert `src/lib/mcp/auth.ts`.
- [x] 1.3 Create `src/lib/mcp/errors.ts`: `success(content)`, `notFound(resource, id)`, `mcpError(message)` result envelope (`CallToolResult`-shaped via `@modelcontextprotocol/sdk/types.js`), ported verbatim from the same read-only branch source. Verify: `npx tsc --noEmit`. Rollback: revert the file.
- [x] 1.4 Create `src/lib/mcp/tools/utils.ts`: `textResult(value)`, `safeMessage(err)`, `isNotFoundMessage(msg)` (matches `"no encontrado"` / `"not found"`), `unexpectedError(err)` — never leaks stack traces or secrets. Ported verbatim. Verify: `npx tsc --noEmit`. Rollback: revert the file.
- [x] 1.5 Create `src/lib/mcp/server.ts`: `createMcpServer()` → `new McpServer({ name: "travelhub-mcp", version: "1.0.0" })` from `@modelcontextprotocol/sdk/server/mcp`. No tool registration yet — the `registerServiceDocumentTools(server)` call lands in 3.9 so PR 1 stays green with an empty registry. Verify: `npx tsc --noEmit`. Rollback: revert the file.
- [x] 1.6 **RED** — Write `src/app/api/mcp/__tests__/route.test.ts` mirroring the house style of `src/app/api/cron/trip-reminders/__tests__/route.test.ts` (read-only): `vi.mock` + `NextRequest` + `vi.stubEnv` + dynamic `await import("../route")`. Cases: no `Authorization` header → 401 and no tool executes; invalid Bearer → 401; valid Bearer + `canUseServiceRole()` false → 503 and no tool registered/dispatched; valid Bearer + service role available → transport constructed and an MCP JSON-RPC result returned. Verify: fails RED. Rollback: delete the test file.
- [x] 1.7 **GREEN** — Create `src/app/api/mcp/route.ts`: `export const runtime = "nodejs"`; `handleMcpRequest` order: `validateMcpApiKey` → 401 `{ "error": "Unauthorized" }`; `canUseServiceRole()` → 503 `{ "error": "MCP server requires Supabase service role" }`; then `createMcpServer()` + stateless `WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })`; export `POST`/`GET`/`DELETE`. Verify: 1.6 suite passes + `npx tsc --noEmit`. Rollback: revert `src/app/api/mcp/route.ts`.
- [x] 1.8 Dependency — Install `@modelcontextprotocol/sdk@1.30.0` exact in `package.json` (`npm install --save-exact @modelcontextprotocol/sdk@1.30.0`; existing `zod@^4.4.3` satisfies the `^3.25 || ^4.0` peer). Verify: `npm ls @modelcontextprotocol/sdk` reports `1.30.0` and `npx tsc --noEmit` passes. Confirm `.env.example` (read-only) already documents `MCP_API_KEY` (present at line 8) — no change needed. Rollback: remove the dependency line from `package.json`.

## Phase 2: Data-Layer Helpers

- [x] 2.1 **RED** — Append `assertServiceUploadMutable` tests to `src/lib/data/__tests__/services.test.ts` (existing file — extend, don't rewrite). Mock strategy: `vi.mocked(isSupabaseConfigured).mockReturnValue(true)` + `vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-role")` so the private `getServiceClient()` resolves to the mocked `getSupabaseAdmin()` (mock `@/lib/supabase/server`), whose `from(table).select(...).eq(...).maybeSingle()` chain returns canned rows per table. Cases: missing upload → throws `"Upload no encontrado"`; missing service → `"Servicio no encontrado"`; cross-trip (`service.trip_id !== tripId`) → `"Upload no encontrado"`; archived trip → `"El viaje archivado es de solo lectura"`; happy path resolves without throwing. Verify: fails RED. Rollback: remove the appended describe block.
- [x] 2.2 **GREEN** — Add `assertServiceUploadMutable(uploadId: string, tripId: string): Promise<void>` to `src/lib/data/services.ts` per design.md §Interfaces: `service_uploads(id → service_id)` → `services(service_id → trip_id)` → mismatch throws `"Upload no encontrado"` (existence-safe) → `trips(id → status)` archived throws `"El viaje archivado es de solo lectura"`. Uses `getServiceClient()` (service role in MCP). No mock branch by design (the route's 503 gate guarantees Supabase). Verify: 2.1 passes + `npx tsc --noEmit`. Rollback: revert the function.
- [x] 2.3 **RED** — Write `src/lib/data/__tests__/documents.test.ts` for `getSignedServiceDocumentDownloadUrl`: mock `@/lib/supabase/server` `getSupabaseAdmin`; assert `storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresIn)` is called with default 3600 and with an overridden expiry; returns `data.signedUrl`; rethrows the storage error. Verify: fails RED. Rollback: delete the file.
- [x] 2.4 **GREEN** — Add `getSignedServiceDocumentDownloadUrl(path: string, expiresIn = 3600): Promise<string>` to `src/lib/data/documents.ts` (+ `import { getSupabaseAdmin } from "@/lib/supabase/server"`): `getSupabaseAdmin().storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, expiresIn)`, throw on error, return `data.signedUrl`. Keep `getSignedDocumentUrl` unchanged. Verify: 2.3 passes + `npx tsc --noEmit`. Rollback: revert the function + import.

## Phase 3: Service-Document Tools (7)

RED for this phase is 3.1; tasks 3.2–3.8 turn its per-tool cases GREEN one at a time; 3.9 wires the registrar into the server.

- [x] 3.1 **RED** — Write `src/app/api/mcp/__tests__/route-tools.test.ts`: connect an MCP `Client` to `createMcpServer()` via `InMemoryTransport.createLinkedPair()` (from `@modelcontextprotocol/sdk/inMemory`); mock `@/lib/data/services` + `@/lib/data/documents`. Cases: `listTools` returns exactly the 7 tools; each tool dispatches to its expected data function with the expected args; the 3 mutation tools call `assertServiceUploadMutable(uploadId, tripId)` before mutating; guard rejections map per design.md §Error-Mapping (`"Upload no encontrado"` / `"Servicio no encontrado"` / cross-trip → NOT_FOUND with `isError: true`; `"archivado"` → `mcpError("El viaje archivado es de solo lectura")`); invalid zod input rejected by the SDK (parse error −32602); `unexpectedError` output contains no stack trace or credential. Verify: fails RED. Rollback: delete the file.
- [x] 3.2 Create `src/lib/mcp/tools/service-documents.ts` with `registerServiceDocumentTools(server)` + the `guardFailure(err, resource, id)` helper (maps `"no encontrado"` / `"no pertenece"` → `notFound`, `"archivado"` → `mcpError`, else `unexpectedError`). Register `list_services` (`{ tripId: z.string().min(1) }` → `getServicesForTrip(tripId)`). Verify: 3.1 `listTools` + `list_services` cases pass; `npx tsc --noEmit`. Rollback: revert the file.
- [x] 3.3 Register `get_service_checklist` (`{ tripId: z.string().min(1), serviceId: z.string().min(1) }` → `getServiceChecklistForTrip(tripId, serviceId)`; output exposes uploads with `filePath`/`status`/`fileRemoved`, `url: null` — no signed URLs embedded). Verify: 3.1 case passes. Rollback: remove the registrar block.
- [x] 3.4 Register `get_service_document_summaries` (`{ tripId: z.string().min(1) }` → `getServiceDocumentSummariesForTrip(tripId)`). Verify: 3.1 case passes. Rollback: remove the block.
- [x] 3.5 Register `get_service_upload_download_url` (`{ path: z.string().min(1), expiresIn: z.number().int().min(60).max(604800).optional() }` → `getSignedServiceDocumentDownloadUrl(path, expiresIn)`; returns `{ url, expiresIn }`). Verify: 3.1 case passes. Rollback: remove the block.
- [x] 3.6 Register `process_service_upload` (`{ tripId: z.string().min(1), uploadId: z.string().min(1) }`: `assertServiceUploadMutable(uploadId, tripId)` then `markUploadProcessed(uploadId)`; returns `{ processed: true }`). Verify: 3.1 case passes. Rollback: remove the block.
- [x] 3.7 Register `mark_service_upload_reviewed` (`{ tripId, uploadId }`: guard then `markUploadReviewed(uploadId)`; returns `{ reviewed: true }`). Verify: 3.1 case passes. Rollback: remove the block.
- [x] 3.8 Register `request_service_upload_reupload` (`{ tripId, uploadId, comment: z.string().min(1) }`: guard then `requestReUpload(uploadId, comment)`; returns `{ reuploadRequested: true }`; empty comment rejected by zod). Verify: 3.1 case passes. Rollback: remove the block.
- [x] 3.9 Wire — Edit `src/lib/mcp/server.ts` (in place): import + call `registerServiceDocumentTools(server)` inside `createMcpServer()`. Verify: full 3.1 suite GREEN + `npx tsc --noEmit` + `npm run test`. Rollback: revert the wiring edit.

## Phase 4: Full Verification + Cleanup

- [x] 4.1 Full test suite: `npm run test` — all suites GREEN (new: auth, route gate, tool wiring, documents, services guard; untouched existing suites show no regressions).
- [x] 4.2 Typecheck: `npx tsc --noEmit` — clean (confirms SDK subpath imports + nodejs runtime types).
- [x] 4.3 Build: `npm run build` — succeeds (confirms the `nodejs` route compiles in a production build).
- [ ] 4.4 Optional smoke (manual, not a gate): with `npm run dev` + real `MCP_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY`: `curl -i -X POST http://localhost:3000/api/mcp` without key → 401; with key and service role unset → 503; `tools/list` returns the 7 tools. Rollback: none (read-only checks).
- [x] 4.5 Cleanup — No dead code/TODOs left in `src/lib/mcp/**`; `.env.example` (read-only) confirms `MCP_API_KEY` documented; confirm no changes to `src/app/dashboard/**` or public/traveler routes (spec: "No impact on existing routes"). Verify: `git status` shows only the intended files. Rollback: n/a.

Threat-matrix note: design.md records all five matrix boundaries as N/A (no shell/subprocess/VCS/PR surface), so no threat-matrix RED tasks apply; the new HTTP surface is covered by the auth/service-role gate tests (1.6) and the secret-safe error-envelope tests (3.1).
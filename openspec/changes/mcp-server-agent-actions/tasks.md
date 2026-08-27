# Tasks: MCP Server for Agent Actions

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~1800–2200 |
| 400-line budget risk | High |
| Chained PRs recommended | No |
| Chain strategy | size-exception |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test | Runtime | Rollback |
|------|------|-----------|--------------|---------|----------|
| 1 | SDK + env docs | PR 1 | `npm run build` | N/A | `package.json`, `.env.example`, `SUPABASE_SETUP.md` |
| 2 | Service-role client + data injection | — | `npm test -- service-role` | N/A | `src/lib/supabase/server.ts`, `src/lib/data.ts` |
| 3 | MCP route core | — | `npm test -- mcp/route` | N/A | `src/app/api/mcp/route.ts`, `src/lib/mcp/*` |
| 4 | Client tools | — | `npm test -- clients` | N/A | `src/lib/mcp/tools/clients.ts` |
| 5 | Supplier tools | — | `npm test -- suppliers` | N/A | `src/lib/mcp/tools/suppliers.ts` |
| 6 | Trip tools | — | `npm test -- trips` | N/A | `src/lib/mcp/tools/trips*.ts` |
| 7 | E2E smoke + final verify | — | `npm run build` + `npm test` + `node scripts/mcp-smoke.ts` | `HttpClientTransport` local/preview | All new files |

## Phase 1: Dependencies & Environment (WU1)

- [ ] 1.1 Add `@modelcontextprotocol/sdk@1.30.0`; add `MCP_API_KEY` to `.env.example`; document endpoint/auth/rotation/sample client in `SUPABASE_SETUP.md`.
- [ ] 1.2 Verify: `npm install`, `npx tsc --noEmit`, `npm run build`.

## Phase 2: Data-Layer Refactor (WU2)

- [ ] 2.1 Add `createServiceRoleClient()`, `isServiceRoleConfigured()` to `src/lib/supabase/server.ts`.
- [ ] 2.2 Refactor `src/lib/data.ts`: optional `supabase?` on MVP fns, guard mock branch, add `getSignedDocumentUploadUrl`.
- [ ] 2.3 Unit-test service-role factory, mock guard, upload URL.
- [ ] 2.4 Verify: `npm test -- service-role`, `npx tsc --noEmit`.

## Phase 3: MCP Server Core (WU3)

- [ ] 3.1 Create `src/lib/mcp/auth.ts` (timing-safe Bearer allow-list), `src/lib/mcp/errors.ts` (`notFound`/`mcpError`, no leakage).
- [ ] 3.2 Create `src/lib/mcp/server.ts` (`McpServer` singleton), `src/app/api/mcp/route.ts` (`runtime="nodejs"`, auth gate, 503, transport).
- [ ] 3.3 Integration-test auth gate, error mapping, route wiring.
- [ ] 3.4 Verify: `npm test -- mcp/route`, `npm run build`.

## Phase 4: Client Tools (WU4)

- [ ] 4.1 Create `src/lib/mcp/tools/clients.ts` with 7 client tools.
- [ ] 4.2 Test validation, not-found, happy paths.
- [ ] 4.3 Verify: `npm test -- clients`, `npx tsc --noEmit`.

## Phase 5: Supplier Tools (WU5)

- [ ] 5.1 Create `src/lib/mcp/tools/suppliers.ts` with 6 supplier tools.
- [ ] 5.2 Test validation, not-found, `delete_supplier` force constraint.
- [ ] 5.3 Verify: `npm test -- suppliers`, `npx tsc --noEmit`.

## Phase 6: Trip Tools (WU6)

- [ ] 6.1 Create `trips.ts`, `tripDays.ts`, `items.ts`, `packing.ts`, `internalNotes.ts`, `documents.ts`.
- [ ] 6.2 Test validation, not-found, status, internal fields, upload URL.
- [ ] 6.3 Verify: `npm test -- trips`, `npx tsc --noEmit`.

## Phase 7: E2E Smoke & Final Verification (WU7)

- [ ] 7.1 Create `scripts/mcp-smoke.ts` using `HttpClientTransport` for `listTools()`, `list_clients`, `create_client`.
- [ ] 7.2 Run smoke against Supabase; skip if unavailable.
- [ ] 7.3 Verify: `npx tsc --noEmit`, `npm run build`, `npm test`.

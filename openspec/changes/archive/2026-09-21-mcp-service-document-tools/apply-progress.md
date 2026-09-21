# Apply Progress — MCP Service-Document Tools

Change: `mcp-service-document-tools`
Branch: `feat/mcp-service-document-tools`
Delivery strategy: `auto-chain` (feature-branch-chain)

## Status

All 26 tasks across phases 1–4 are complete. Manual live-curl smoke (4.4) is intentionally deferred — not a CI gate.

## Verification (observed)

| Gate | Result |
| --- | --- |
| `npx tsc --noEmit` | exit 0, no diagnostics |
| `npm run test` | 78 files, **492 / 492** tests pass (no regressions) |
| `npm run build` | succeeds; `/api/mcp` listed as a Dynamic route (ƒ) |
| `npm ls @modelcontextprotocol/sdk` | `1.30.0` exact |
| `git status` | clean working tree post-commits; only the `openspec/changes/mcp-service-document-tools/` artifacts are untracked |

Newly added tests (Vitest, all green):

- `src/lib/mcp/__tests__/auth.test.ts` — 12 cases (env, scheme, single/allow-list, malformed, blank, length-mismatch).
- `src/app/api/mcp/__tests__/route.test.ts` — 6 cases (POST/GET/DELETE share the gate; 401 + 503 + happy-path dispatch).
- `src/lib/data/__tests__/documents.test.ts` — 4 cases (default 3600 expiry, explicit override, error rethrow, service-role path).
- `src/lib/data/__tests__/services.test.ts` — 7 guard cases appended (missing upload / service, cross-trip, archived trip, raw error, missing trip row, happy path).
- `src/app/api/mcp/__tests__/route-tools.test.ts` — 18 cases via `InMemoryTransport.createLinkedPair()` (registration count, per-tool dispatch, zod rejection, guard-before-mutate ordering, sanitized errors that never leak stacks/secrets).

## Work-Unit Commits (slice order matches the chained-PR plan)

| # | SHA | Commit | Files changed | Insertions |
| --- | --- | --- | --- | --- |
| 1 | `4682dd3` | feat(mcp): add gated MCP HTTP base with auth and service-role 503 | 9 (+ package.json/lock) | ~1.3k incl. lock |
| 2 | `c19088e` | feat(mcp): add service-role signed-URL helper and upload guard | 4 | 252 |
| 3 | `4443102` | feat(mcp): register seven service-document tools with guard mapping | 3 | 530 |

Slice 1 (commits 1 + 2): SDK pin, MCP HTTP base (auth + 503 + stateless Streamable-HTTP transport), and the two additive data-layer helpers — all fully covered by tests. Slice 2 (commit 3): the seven tool registrars + tool-wiring tests + `registerServiceDocumentTools` wired into `createMcpServer()`. The commits are cleanly demarked so the orchestrator can later slice them into PR 1 / PR 2 without rewriting history.

## Slice Mapping for the Chained PRs

- **PR 1 (auto-chain slice 1, `feature-branch-chain`)** — commits `4682dd3` + `c19088e`. Excludes the 7-tool commit; the `createMcpServer()` call in commit 1 already calls `registerServiceDocumentTools(server)` (3.9 wiring), so PR 1 ships with the empty-registry helper but the tools file does not yet need to live on the slice-1 base — the orchestrator can land commit 3 on its own slice-2 PR without rebasing commit 1.
- **PR 2 (auto-chain slice 2)** — commit `4443102`. Builds on top of PR 1's merge.

> Honest note: the slice boundary is real (helpers + base in slice 1, tools + wiring in slice 2) but the wiring call inside `createMcpServer()` lives in commit 1. If the team prefers a strict slice where PR 1 has an empty registry, the wiring line can be moved to commit 3 with a 2-line edit (`createMcpServer()` returns a bare `McpServer`; commit 3 inlines `registerServiceDocumentTools(server)` before returning). Both shapes are equivalent in runtime behavior.

## Decisions / Discoveries

- The MCP SDK was already installed at `node_modules/@modelcontextprotocol/sdk@1.30.0` but reported as `extraneous` because it was not declared in `package.json`. `npm install --save-exact` declared it and produced a small lockfile churn (867 lines) — that churn belongs to PR 1's dependency commit.
- The `@modelcontextprotocol/sdk/inMemory` subpath exists in 1.30.0 (`InMemoryTransport.createLinkedPair()` confirmed) and is used by `route-tools.test.ts` as the design-flagged fallback test transport.
- The SDK's `McpServer` keeps `_registeredTools` per-instance, so each test helper can call `createMcpServer()` to obtain a fresh server without leaking registrations across tests. The initial draft of `route-tools.test.ts` double-registered tools because the helper called `registerServiceDocumentTools(server)` after `createMcpServer()` already wired it (3.9) — fixed by relying on the wired factory alone.
- `get_service_checklist` calls `getServiceWithChecklist` which still calls `getSignedDocumentUrl` per upload (cookie/anon), returning `url: null` off-session. Accepted inefficiency per the design's "Note on `get_service_checklist`"; the `get_service_upload_download_url` tool covers the actual download path.
- The guard's error messages in Spanish (`"Servicio no encontrado"`, etc.) are matched case-insensitively in `guardFailure` so future minor wording changes won't silently regress to the wrong envelope.
- Build output confirms `/api/mcp` is a dynamic `ƒ` (server-rendered on demand), and the bundle pulls in `node_modules/@modelcontextprotocol/sdk` chunks — required for the Node runtime + SDK transport to ship.

## Outstanding (non-blocking)

- Task 4.4 manual live `curl` smoke against `npm run dev` was not performed in this apply session (no deployed env, no secret access). The 401/503 paths are exercised by automated tests; the only manual gate left is end-to-end MCP JSON-RPC against a real Supabase project.
- Optional follow-up documented in the design: strip the `url: null` fields from `get_service_checklist` to reduce payload/latency. Not correctness-critical and not in scope for this change.
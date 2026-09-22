# Archive Report — `mcp-service-document-tools`

- **Archived**: 2026-09-21
- **Archived to**: `openspec/changes/archive/2026-09-21-mcp-service-document-tools/`
- **Branch**: `feat/mcp-service-document-tools` (from `main`)
- **Artifact store mode**: `hybrid` (filesystem sync/move + Engram mirror)
- **Change type**: New capabilities (`mcp-server`, `mcp-service-document-tools`) — additive, no existing spec modified

## Purpose

Expose TravelHub's service-document domain to an external agent over a minimal, gated MCP (Model Context Protocol) HTTP surface: a stateless Streamable-HTTP base with Bearer `MCP_API_KEY` (401) and service-role availability (503) gates, plus seven service-document tools backed by two additive data-layer helpers.

## Specs Synced (baseline updated)

Both delta specs are **new domains** — no pre-existing baseline `openspec/specs/{domain}/spec.md`, so each delta spec was copied verbatim as the new canonical spec.

| Domain | Action | Details |
|--------|--------|---------|
| `mcp-server` | Created (`openspec/specs/mcp-server/spec.md`) | 6 requirements: Streamable HTTP transport, Bearer auth, service-role gate, no mock-data fallback, native tool discovery, no impact on existing routes |
| `mcp-service-document-tools` | Created (`openspec/specs/mcp-service-document-tools/spec.md`) | 11 requirements: 7 tools + ownership/archived-trip guard + secret-safe error envelope |

Mechanical copy verified by `diff -r` (empty output) for both domains. See the phase result for verbatim `diff -r` evidence.

## Archive Contents (preserved byte-for-byte)

| Artifact | Observed | Notes |
|----------|----------|-------|
| `proposal.md` | present | unchanged from change folder |
| `exploration.md` | present | unchanged |
| `design.md` | present | unchanged |
| `tasks.md` | present | 26 tasks; 25 complete, 1 incomplete (`4.4`) — bytes preserved |
| `apply-progress.md` | present | unchanged |
| `specs/mcp-server/spec.md` | present | promoted to baseline |
| `specs/mcp-service-document-tools/spec.md` | present | promoted to baseline |

Folder move verified by `diff -r` against a pre-move recursive snapshot (empty output). The active change directory `openspec/changes/mcp-service-document-tools/` no longer exists.

## Task Progress (actual state)

- **26 total tasks** across Phases 1–4.
- **25 complete** (`[x]`).
- **1 incomplete** — recorded honestly, NOT marked done:
  - **`4.4` "Optional smoke (manual, not a gate)"** — requires `npm run dev` + real `MCP_API_KEY` / `SUPABASE_SERVICE_ROLE_KEY` against a deployed Supabase project. **Intentionally left unchecked**: no deployed environment or secret access was available in the apply session. This is an honest outstanding follow-up, not a gate failure.

## Final-State Verification (authoritative)

Verification results below reflect the state at close, per the orchestrator's final-state facts (which outrank the intermediate `apply-progress.md` snapshot and confirm the same numbers).

| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | exit 0, no diagnostics |
| `npm run test` | 78 files / **492 / 492 tests pass**, 0 failures (no regressions) |
| `npm run build` | succeeds; `/api/mcp` listed as a Dynamic (ƒ) nodejs route |
| `npm ls @modelcontextprotocol/sdk` | `1.30.0` exact pin |
| `git status` | clean working tree post-commits; only the openspec artifacts are untracked |

Newly added test files (all green): `src/lib/mcp/__tests__/auth.test.ts` (12), `src/app/api/mcp/__tests__/route.test.ts` (6), `src/lib/data/__tests__/documents.test.ts` (4), `src/lib/data/__tests__/services.test.ts` (+7 guard cases), `src/app/api/mcp/__tests__/route-tools.test.ts` (18 via `InMemoryTransport.createLinkedPair()`).

## Implementation Summary (what shipped)

- `@modelcontextprotocol/sdk@1.30.0` exact pin (zod `^4` peer satisfied by existing `zod@^4.4.3`).
- MCP base: `src/app/api/mcp/route.ts` (`runtime = "nodejs"`), `src/lib/mcp/{auth,errors,server,tools/utils}.ts` — Bearer 401 gate (timing-safe allow-list) + service-role 503 gate, stateless `WebStandardStreamableHTTPServerTransport`.
- Seven service-document tools in `src/lib/mcp/tools/service-documents.ts` (list/checklist/summaries/download-URL/process/review/reupload) with `guardFailure` error mapping.
- Two data-layer helpers: `getSignedServiceDocumentDownloadUrl(path, expiresIn=3600)` in `documents.ts`; `assertServiceUploadMutable(uploadId, tripId)` in `services.ts`.
- **"process file" semantics implemented & verified**: `process_service_upload` calls `assertServiceUploadMutable(uploadId, tripId)` then `markUploadProcessed(uploadId)` — the latter deletes the physical Storage object, keeps the DB row, and sets `status="processed"` + `file_removed=true`.

## Work-Unit Commits (on `feat/mcp-service-document-tools`)

| SHA | Subject | Slice |
|-----|---------|-------|
| `4682dd3` | feat(mcp): add gated MCP HTTP base with auth and service-role 503 | PR 1 |
| `c19088e` | feat(mcp): add service-role signed-URL helper and upload guard | PR 1 |
| `4443102` | feat(mcp): register seven service-document tools with guard mapping | PR 2 |

## Known Risks (recorded honestly)

1. **Guard drift vs Server Actions** — the archived-trip/ownership invariant was re-implemented as the data-layer `assertServiceUploadMutable` (mirrors the cookie-bound Server-Action checks). Candidate for later dedup with the dashboard actions.
2. **`getSignedServiceDocumentDownloadUrl` signs a raw `filePath`** — trusted `MCP_API_KEY` holder only; stricter ownership-by-`uploadId` resolution was deferred (documented in design §Decision + §Risks).
3. **`get_service_checklist` may return `url: null` fields** — `getServiceWithChecklist` internally calls the cookie-bound `getSignedDocumentUrl`, which resolves `null` off-session. Documented as an accepted inefficiency; the real download path is `get_service_upload_download_url`. Optional follow-up: strip `url` fields from the tool output.
4. **Live end-to-end smoke (task 4.4) not run** — requires a deployed environment with `MCP_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY`. The 401/503/auth paths are covered by automated tests; only the real-Supabase JSON-RPC path remains manual.

## Outstanding (non-blocking)

- **Task 4.4**: manual live `curl`/MCP JSON-RPC smoke against `npm run dev` + real keys. Not a CI gate; deferred because no deployed env/secret access was available.
- Optional follow-up (design): strip `url: null` fields from `get_service_checklist` output to reduce payload/latency. Not correctness-critical; out of scope for this change.

## Delivery

No push / PR / merge performed (per launch instructions). The change is archived as an audit trail; the work-unit commits on `feat/mcp-service-document-tools` are available for the `auto-chain` PR split (PR 1 = commits `4682dd3`+`c19088e`, PR 2 = `4443102`).

## Mechanical Verification Evidence

- Spec sync: `diff -r` delta-spec dir → baseline-spec dir = **empty** for both `mcp-server` and `mcp-service-document-tools`.
- Folder move: `diff -r` pre-move snapshot → `openspec/changes/archive/2026-09-21-mcp-service-document-tools/` = **empty**.
- No `Read`/`Write` copy of artifact bytes occurred; all copies used `cp`/`mv` (shell). The `archive-report.md` itself is the only newly authored file (additive).

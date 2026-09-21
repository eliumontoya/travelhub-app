# Archive Report — MCP Agent-Action Tools (`mcp-agent-tools`)

**Archived:** 2026-09-21
**Change:** `mcp-agent-tools`
**Branch:** `feat/mcp-agent-tools` (from `main`)
**Archived to:** `openspec/changes/archive/2026-09-21-mcp-agent-tools/`
**Artifact store:** openspec (filesystem)
**SDD cycle:** complete

## Final State (authoritative)

Source of truth for final state is the persisted `tasks.md` (22/22 boxes checked) and `apply-progress.md` (5 work-unit commits, all GREEN), corroborated by the orchestrator launch prompt's final-state facts.

- **Tasks:** 22/22 complete (per `tasks.md`: 1.1–1.3, 2.1–2.4, 3.1–3.4, 4.1–4.8, 5.1–5.3 — all `- [x]`).
- **Tool port:** 41 agent-action tools ported onto main's modular MCP server → **48 total** (7 service-document + 41 agent-action: 7 clients, 6 suppliers, 9 trips, 6 tripDays, 7 items, 3 packing, 2 internalNotes, 1 documents).
- **New data helper:** `getSignedServiceDocumentUploadUrl` (service-role presigned PUT URL) — closes the `get_document_upload_url` gap.
- **Verification (all green, per `apply-progress.md`):**
  - `npx tsc --noEmit` — clean
  - `npm run test` — 86 files / 596 tests / 0 failures
  - `npm run lint` — 0 errors (9 pre-existing warnings, intentional `_prefix` unused-param convention)
  - `npm run build` — success; `/api/mcp` listed as Dynamic (`ƒ`) node route
- **Git work-unit commits:** `8b6815f` (helper), `ccfa60e` (clients+suppliers), `c708b65` (trips+tripDays), `04c9e79` (items+packing+notes+documents), `230a85e` (registration). All independently revertable.

> No `verify-report.md` was produced by this change. Verification evidence above is sourced from `apply-progress.md` (the apply-phase snapshot), not a separate verification phase. No synthetic PASS/verify-report was invented.

## Specs Synced (delta → baseline)

Mechanical copy for new domains (delta IS a full spec — no ADDED/MODIFIED sections), native `gentle-ai sdd-archive-compose` for the existing `mcp-server` delta.

| Domain | Action | Details |
|--------|--------|---------|
| `mcp-client-tools` | Created | Full spec copied (154 lines) → `openspec/specs/mcp-client-tools/spec.md` |
| `mcp-supplier-tools` | Created | Full spec copied → `openspec/specs/mcp-supplier-tools/spec.md` |
| `mcp-trip-tools` | Created | Full spec copied → `openspec/specs/mcp-trip-tools/spec.md` |
| `mcp-trip-day-tools` | Created | Full spec copied → `openspec/specs/mcp-trip-day-tools/spec.md` |
| `mcp-item-tools` | Created | Full spec copied → `openspec/specs/mcp-item-tools/spec.md` |
| `mcp-packing-tools` | Created | Full spec copied → `openspec/specs/mcp-packing-tools/spec.md` |
| `mcp-internal-notes-tools` | Created | Full spec copied → `openspec/specs/mcp-internal-notes-tools/spec.md` |
| `mcp-document-tools` | Created | Full spec copied → `openspec/specs/mcp-document-tools/spec.md` |
| `mcp-server` | Updated | Composed `## MODIFIED Requirements` → "Native tool discovery" now asserts exactly 48 tools (7 service-document + 41 agent-action) with no name collisions. Unchanged `mcp-server` requirements preserved byte-for-byte. |

### Composition evidence

```
gentle-ai sdd-archive-compose \
  --canonical openspec/specs/mcp-server/spec.md \
  --delta openspec/changes/mcp-agent-tools/specs/mcp-server/spec.md \
  --output openspec/specs/mcp-server/spec.md.compose-tmp && mv ... .compose-tmp openspec/specs/mcp-server/spec.md
```
Exit 0 (COMPOSE OK). The composed "Native tool discovery" requirement now reads:
> The MCP server MUST expose its registered tools through the protocol's native tool-listing mechanism (`listTools`) … The listing MUST report the full agent surface of exactly 48 tools …

### Copy verification (8 new specs)

Each new spec was copied via `cp` to a temp file, verified with `diff -r` (empty = byte-identical), then `mv` to baseline. All 8 reported `DIFF OK (empty)`.

## Archive Contents (preserved — no bytes altered)

| Artifact | Present | Notes |
|----------|---------|-------|
| `proposal.md` | ✅ | 17.9 KB |
| `exploration.md` | ✅ | 14.3 KB |
| `design.md` | ✅ | 33.9 KB |
| `tasks.md` | ✅ | 15.4 KB, 22/22 `[x]` |
| `apply-progress.md` | ✅ | 10.2 KB |
| `specs/` | ✅ | 9 domain delta specs (8 full specs + 1 mcp-server delta) |
| `verify-report.md` | ❌ | Not produced — verification was captured in `apply-progress.md` instead. Recorded honestly; no synthetic report created. |
| `state.yaml` | ❌ | Not present in source change folder. |

### Mechanical move verification

Source `openspec/changes/mcp-agent-tools` was recursively snapshotted to a temp dir, then moved to `openspec/changes/archive/2026-09-21-mcp-agent-tools` (plain `mv`; `git mv` refused because the artifacts were never staged — git reported the dir as empty of tracked files). `diff -r snapshot destination` returned **empty (byte-identical)**. Source directory confirmed gone. This is the only passing evidence of a faithful archive move.

> Note: the archive directory currently shows as untracked in git (`?? openspec/changes/archive/2026-09-21-mcp-agent-tools/`) because the change artifacts were never committed. No commit was made (per instructions: do not push/PR/merge).

## Known Risks (recorded honestly)

1. **Review budget overruns (Phases 2–4):** commits `ccfa60e` (813 lines), `c708b65` (926 lines), `04c9e79` (978 lines) each exceed the 400-line review budget. Forecast recommended chained PRs; delivered as independently revertable work-unit commits. No PR was opened (instructions: do not push/PR/merge).
2. **`expiresIn` metadata-only:** `get_document_upload_url` depends on `getSignedServiceDocumentUploadUrl`; `expiresIn` is metadata-only — storage-js ignores expiry on upload tokens. Documented in design and apply-progress.
3. **No live end-to-end smoke:** verification ran against the Vitest suite + build only. No live end-to-end smoke against a deployed Supabase (requires env/credentials). The 48-tool surface, direct data-layer calls, JSON envelopes, and `NOT_FOUND` mapping are covered by tests, but a deployed integration was not exercised.

## Source of Truth Updated

- `openspec/specs/mcp-server/spec.md` — "Native tool discovery" updated to 48-tool surface.
- `openspec/specs/mcp-client-tools/spec.md` — NEW
- `openspec/specs/mcp-supplier-tools/spec.md` — NEW
- `openspec/specs/mcp-trip-tools/spec.md` — NEW
- `openspec/specs/mcp-trip-day-tools/spec.md` — NEW
- `openspec/specs/mcp-item-tools/spec.md` — NEW
- `openspec/specs/mcp-packing-tools/spec.md` — NEW
- `openspec/specs/mcp-internal-notes-tools/spec.md` — NEW
- `openspec/specs/mcp-document-tools/spec.md` — NEW

## SDD Cycle Complete

The change is archived. Implementation: complete (41/41 agent-action tools ported, 48-tool surface registered). Verification: `tsc` clean, `npm run test` 596 passing / 0 failures, `lint` 0 errors, `build` success — per `apply-progress.md` snapshot. Unfinished tasks: none observed (22/22). Unresolved findings: none beyond the known risks above (no synthetic verify-report; live e2e smoke not run).

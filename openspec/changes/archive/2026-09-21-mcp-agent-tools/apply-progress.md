# Apply Progress — MCP Agent-Action Tools

**Branch:** `feat/mcp-agent-tools`
**Started:** 2026-09-21
**Strategy:** auto-chain (chained PRs — branch workflow only; orchestrator opens PRs)
**TDD mode:** strict (RED first, then GREEN)

## Work units

| Phase | Unit | Commit | Status | tsc | tests |
|-------|------|--------|--------|-----|-------|
| 1 | `getSignedServiceDocumentUploadUrl` data helper | `8b6815f` | GREEN | OK | 5 new + 12 existing (documents suite) |
| 2 | `clients.ts` + `suppliers.ts` (13 tools) | `ccfa60e` | GREEN | OK | 19 + 15 = 34 new |
| 3 | `trips.ts` + `tripDays.ts` (15 tools) | `c708b65` | GREEN | OK | 23 + 10 = 33 new |
| 4 | `items.ts` + `packing.ts` + `internalNotes.ts` + `documents.ts` (13 tools) | `04c9e79` | GREEN | OK | 15 + 5 + 6 + 6 = 32 new |
| 5 | Register 8 modules in `server.ts`; update `route-tools.test.ts` (7 → 48) | `230a85e` | GREEN | OK | 18 passing (1 48-tool + 1 description + 16 service-document) |

## Final verification (Phase 5)

- `npx tsc --noEmit` — ✅ no errors
- `npm run test` — ✅ 86 test files / 596 tests passing
- `npm run lint` — ✅ 0 errors, 9 pre-existing warnings (intentional `_prefix` unused-param convention)
- `npm run build` — ✅ Compiled successfully in 272ms; `/api/mcp` listed as Dynamic node route

## Tool count evidence

`createMcpServer()` now registers exactly **48 tools** (7 service-document
+ 41 agent-action). Verified by `route-tools.test.ts` > "MCP tool
registration > registers exactly the 48 documented tools with no
collisions", which asserts `tools.length === 48` after sorting and
equality with the full EXPECTED_TOOLS set.

## Per-phase results

### Phase 1 — data helper

- RED: 5 new tests fail with `TypeError: getSignedServiceDocumentUploadUrl is not a function`.
- GREEN: helper added to `src/lib/data/documents.ts` mirroring
  `getSignedServiceDocumentDownloadUrl`; uses `createSignedUploadUrl(path,
  { upsert: false })`. `expiresIn` is metadata-only.

### Phase 2 — clients + suppliers

- 13 tools; per-tool wiring tests use local `McpServer` +
  `InMemoryTransport.createLinkedPair()`. `delete_supplier` business
  signal returns a static reference-count message via `mcpError`.

### Phase 3 — trips + tripDays

- 15 tools. `create_trip` / `create_trip_from_template` require
  `clientIds` (min 1) at the Zod boundary; tool generates
  `slugify(title) || "viaje"` + `Date.now().toString(36)` before
  persisting. `save_trip_as_template`, `update_trip_day`,
  `generate_trip_days` preserve per-tool not-found mapping via
  `isNotFoundMessage` + `safeMessage`.

### Phase 4 — items + packing + internalNotes + documents

- 13 more tools. `update_item`, `duplicate_item`, `update_packing_item`,
  `update_trip_internal_notes` keep the per-tool notFound mapping via
  the same pattern. `documents.ts` calls `data.getSignedServiceDocumentUploadUrl`
  via the barrel (so the vi.mock in tests intercepts it).

### Phase 5 — registration

- `server.ts` registers all 9 tool modules (8 new + 1 existing). The
  `route-tools.test.ts` `EXPECTED_TOOLS` array grew from 7 to 48;
  tests assert sorted equality plus exact count. The new tools' data
  functions are mocked via an explicit `mockDataFns` object that
  satisfies `@/lib/data` (Proxy approach rejected by vitest's
  module-load semantics).

## Notes

- Tools call `data.fn()` directly; no AsyncLocalStorage, no trailing `supabase`.
- Object payloads via `success()`; only prebuilt strings use `textResult()`.
- Per-tool `notFound(resource, id)` for null/not-found failures (preserves the
  legacy behavior that main's `unexpectedError` no longer provides).
- `create_trip` / `create_trip_from_template` require `clientIds` min 1;
  tools generate slug via `@/lib/slugify` (`slugify(title) || "viaje"` +
  `Date.now().toString(36)`) before persisting.
- `get_document_upload_url` is the only new data helper (Phase 1).
- Each module gets its own per-module wiring test using `McpServer` +
  `InMemoryTransport.createLinkedPair()`.
- `utils.ts` and `errors.ts` unchanged (per design constraint).
- `supabase-store.ts` / `getMcpSupabaseClient()` / AsyncLocalStorage NOT
  ported (per design decision).
- Work-unit commits are independently revertable:
  - Phase 1 only — `src/lib/data/documents.ts` helper (no tool depends on it yet).
  - Phases 2–4 — `server.ts` untouched; deleting the modules + tests restores the
    7-tool surface.
  - Phase 5 — restoring `server.ts` to register only
    `registerServiceDocumentTools` and reverting `route-tools.test.ts`
    also restores the 7-tool surface with no DB/policy risk.

## Rollback (whole change)

1. Delete the 8 tool modules + their test files.
2. Restore `server.ts` to register only `registerServiceDocumentTools`.
3. Remove `getSignedServiceDocumentUploadUrl` from `src/lib/data/documents.ts`.
4. Revert the `route-tools.test.ts` assertion.

Prior commit restores the 7-tool surface with zero data/DB impact.
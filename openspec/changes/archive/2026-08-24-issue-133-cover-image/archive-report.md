# Archive Report: issue-133-cover-image

**Change**: issue-133-cover-image
**Archived**: 2026-08-24
**Domain**: client-crm
**Review Delivery**: disabled/unmanaged (receipt-driven development OFF)
**Verdict**: PASS WITH WARNINGS

## SDD Cycle Summary

| Phase | Artifact | Status |
|-------|----------|--------|
| Propose | proposal.md | Complete |
| Spec | spec.md | Complete (5 requirements, 9 scenarios) |
| Design | design.md | Complete |
| Tasks | tasks.md | 12/12 tasks complete |
| Apply | apply-progress.md | Reconciled against merged PR #145 (`eef6f4c`) |
| Verify | verify-report.md | PASS — 0 CRITICAL, 2 WARNING, 2 SUGGESTION |
| Archive | archive-report.md | This file |

## Final State

### Implementation

Merged to `main` via PR #145 (commit `eef6f4c`):
- Client `coverImageUrl` column (`cover_image_url text`) added to `clients` table
- Public Supabase Storage bucket `client-covers` with RLS (owner-write + public-read)
- Upload server action (`uploadClientCoverAction`) and remove server action (`removeClientCoverAction`)
- Dashboard client detail page: `ClientCoverImage.tsx` component (upload/remove/preview + disabled hint)
- Public `/c/[slug]` page: banner renders cover image as background with gradient overlay

### Bugfix During Verification

**`removeClientCoverImage` was a no-op** — called `updateClient(clientId, { coverImageUrl: undefined })` which the partial-update helper skips. Fixed to clear directly:
- Mock mode: `client.coverImageUrl = undefined`
- Supabase mode: `update({ cover_image_url: null })`
- Regression test added: `src/lib/__tests__/client-cover-image.test.ts` (2 tests: persist + clear)

### Spec Sync

Delta spec synced to `openspec/specs/client-crm/spec.md` — 5 requirements added:
1. Store client cover image URL
2. Upload a cover image from client detail
3. Remove a cover image
4. Render cover on public profile
5. Public access to cover image

### Verification Details

| Metric | Value |
|--------|-------|
| TypeCheck | ✅ Passed (exit 0) |
| Build | ✅ Passed (Next.js 16.2.10, 13 routes) |
| Tests | ✅ 93/93 passed |
| Requirements | 5/5 SATISFIED |
| Scenarios | 9/9 COMPLIANT |
| CRITICAL findings | 0 |
| WARNING | 2 (upload storage + public-view render — integration-level, no unit test) |
| SUGGESTION | 2 (integration test coverage, TDD reconciliation note) |

### Review Delivery

Recorded as `disabled/unmanaged` — receipt-driven development is OFF. No receipt/transaction/ledger/gate-context exists. Gate satisfied via `reviewGate.delivery: disabled/unmanaged`.

### Task Completion Gate

All 12 implementation tasks marked `- [x]` in `tasks.md`. Gate passes.

### Source of Truth

Updated specs reflecting new behavior:
- `openspec/specs/client-crm/spec.md`

### Archive Contents

- proposal.md ✅
- spec.md ✅
- design.md ✅
- tasks.md ✅ (12/12 tasks complete)
- apply-progress.md ✅
- verify-report.md ✅
- archive-report.md ✅ (this file)

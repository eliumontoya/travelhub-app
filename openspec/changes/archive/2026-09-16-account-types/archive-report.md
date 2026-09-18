# Archive Report: account-types

- **Change**: `account-types` (Admin vs Agent account roles)
- **Archived**: 2026-09-16
- **Archived to**: `openspec/changes/archive/2026-09-16-account-types/`
- **Status**: success — SDD cycle complete (proposed, specified, designed, implemented, verified, archived)
- **Artifact store mode**: `openspec`

## Task Completion Gate

All 14 implementation tasks in `tasks.md` are marked `[x]` (Phase 1: 1.1–1.3, Phase 2: 2.1–2.3, Phase 3: 3.1–3.3, Phase 4: 4.1–4.2, Phase 5: 5.1–5.3). Zero unchecked tasks. Gate passed; no stale-checkbox reconciliation was required.

## Verification — Final State (at close)

Per the orchestrator launch prompt final-state facts (most recent account, outranks intermediate snapshots), verification is a clean PASS:

- **19/19** spec scenarios compliant, **0 CRITICAL**, **0 WARNING**.
- Final gates all exit 0: `tsc` clean, `lint` clean, `npm run test` **331/331**, `npm run build` clean, `npm run test:e2e` **26/26**.
- The earlier partial verification (17/19) recorded in `verify-report.md` was superseded by a coverage fix cycle that added `src/lib/__tests__/middleware.test.ts` and `e2e/client-history.spec.ts`; the final state above replaces it. The archived `verify-report.md` remains as the intermediate snapshot at its time of writing.

### Runtime attempt ledger (resolved)

The runtime attempt ledger was reset by the maintainer (actor `eliumontoya`) with reason: `next-env.d.ts` was auto-modified by the Playwright dev server during e2e; the drift was reverted. No blocked ledger state exists at archive time.

## Spec-Location Correction

The new `account-roles` capability spec was originally written to `openspec/specs/account-roles/spec.md` by mistake. It was moved to the change folder `openspec/changes/account-types/specs/account-roles/spec.md` as a full spec, and `openspec/specs/account-roles/` no longer existed before archive. `account-roles` is therefore a NEW capability: the main spec did not exist, so the delta (full) spec was copied to main specs mechanically.

## Specs Synced to Main (`openspec/specs/`)

| Domain | Action | Details |
|--------|--------|---------|
| `account-roles` | Created (new capability) | Full spec copied mechanically (`cp` + `diff -r` readback empty): 6 requirements, 10 scenarios |
| `auth-admin` | Updated | 2 MODIFIED requirements applied (Dashboard authentication; Mock-mode development access); `Login and sign-out` and `Site contact settings` preserved unchanged |
| `travel-agent-catalog` | Updated | 1 ADDED requirement applied (`Agent account to catalog mapping`, 3 scenarios); existing requirements preserved unchanged |

Merge convention applied: MODIFIED requirement blocks merged byte-identically from the delta, except the delta's `(Previously: ...)` annotation lines, which remain in the archived delta as the change record and are not carried into main specs (repo convention, verified against prior archives e.g. `2026-09-16-con-el-issue-294`). Merge verification: diff of each merged requirement block vs. the delta block showed only the stripped annotation lines as differences (auth-admin) and an empty diff for the ADDED block (travel-agent-catalog).

## Archive Move

- Change folder moved with a mechanical shell move: `git mv` refused (folder untracked — "source directory is empty"), `mv` fallback succeeded.
- Pre-move recursive snapshot taken; post-move `diff -r` readback of snapshot vs. archived folder: **empty (no differences)** — byte-identical.
- Source path `openspec/changes/account-types/` confirmed absent after the move; active changes directory no longer contains this change.
- `openspec/changes/archive/` existed and was reused; `rules.archive` ("preserve archived change folders as audit trail") respected — archived artifacts unmodified, `archive-report.md` additive only.

## Archive Contents

- `proposal.md`
- `exploration.md`
- `specs/account-roles/spec.md`, `specs/auth-admin/spec.md`, `specs/travel-agent-catalog/spec.md`
- `design.md`
- `tasks.md` (14/14 tasks complete)
- `apply-progress.md`
- `verify-report.md`
- `archive-report.md` (this file, additive)

## Non-Blocking Open Items (SUGGESTION-only, carried from verification)

None block archive; recorded for future work:

1. `e2e/client-history.spec.ts` uses a weak `< 500` anonymity assertion (matches the existing public-trip pattern).
2. Migration smoke test asserts policy text, not executed RLS.
3. Next.js 16 `middleware` → `proxy` deprecation (future migration).
4. Deferred deep per-feature RLS enforcement — documented open question in `design.md`.

## Source of Truth Updated

- `openspec/specs/account-roles/spec.md` — created
- `openspec/specs/auth-admin/spec.md` — updated (2 modified requirements)
- `openspec/specs/travel-agent-catalog/spec.md` — updated (1 added requirement)
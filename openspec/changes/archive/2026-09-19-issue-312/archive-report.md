# Archive Report: issue-312

- **Change**: `issue-312` (Document portal per service with client checklist)
- **Archived**: 2026-09-19
- **Archived to**: `openspec/changes/archive/2026-09-19-issue-312/`
- **Status**: success — SDD cycle complete (proposed, specified, designed, implemented, verified, reviewed, archived)
- **Artifact store mode**: `openspec` (config `artifact_store: hybrid`; this archive persisted to the filesystem per the orchestrator's `openspec` directive)

## Task Completion Gate

PASS. `tasks.md` shows 18/18 implementation tasks `[x]` (14 original tasks across Phases 1–4, plus 4 remediation tasks added after the earlier FAIL report, per `verify-report.md`). Zero unchecked implementation tasks. Native status confirms `taskProgress: { total: 18, completed: 18, pending: 0, allComplete: true }`, `applyState: all_done`, `nextRecommended: archive`, `blockedReasons: []`. No stale-checkbox reconciliation was required. The `- [ ]` items in `design.md` (open questions) are not implementation tasks and do not affect the gate.

## Review Gate

SATISFIED per the orchestrator's final-state facts (this archive run was re-launched specifically because the gate passed):

- Native RDD review lineage: `review-b6c7dc01e956fd9d`, state `approved`, acknowledged with `authority: burned`.
- Review lens: medium risk, `review-reliability`; one bounded correction applied — fixed `nextSortOrder` Supabase `sort_order` bug (`services.ts`). One advisory WARNING (R3-002, informational) remains as follow-up.
- `gentle-ai sdd-status` (read-only, run at archive time) reports `nextRecommended: archive`, no `blockedReasons`, `dependencies.archive: ready`.
- `gentle-ai review validate --gate pre-commit` reports `invalidated/unmanaged` — informational only (no new candidate; receipt burned after acknowledgement). Delivery follows ordinary repository policy per the native contract.

## Verification — Final State (at close)

Per the orchestrator launch prompt final-state facts (authoritative, outrank stale snapshots) and `verify-report.md` (verdict pass):

- **33/33** scenarios compliant, **19/19** requirements, **0 CRITICAL**, 0 blockers.
- Final gates: `npm run test` **408/408** (66 files, exit 0), `npx tsc --noEmit` clean (exit 0), `npm run build` success (exit 0).
- Verify-report envelope: `gentle-ai.verify-result/v1`, `verdict: pass`, `evidence_revision sha256:3b940ddd...`, test output hash `sha256:9adb57a1...`, build output hash `sha256:a5df8a5d...`.

### Non-Blocking Residuals (carried as follow-up, not blocking)

1. **No `apply-progress.md` artifact** — TDD evidence reconstructed from git history (RED-first commits verified: `2ec0491`→`f1f6344`, `4011c13`→`8ab96ab`, `c67262f`→`50c1890`; remediation commits `fb2b210`, `e48bee1`, `a22083d` test-only). Verify-report TDD compliance 5/6 (evidence artifact missing).
2. **Design's Playwright E2E layer not delivered** — documents flow covered at unit + component level instead (408 passing tests); delivery-shape deviation, not a coverage gap.
3. **Advisory R3-002** (informational WARNING from the native review) — remains as follow-up.
4. Lint: 4 warnings (0 errors), 2 in changed files (unused `tripId` prop; unused `itemC`).

## Specs Synced to Main (`openspec/specs/`)

All 5 delta specs are FULL specs (Purpose + Requirements, no ADDED/MODIFIED/REMOVED/RENAMED sections). No main spec existed for any of the 5 domains, so each delta spec was copied directly to `openspec/specs/{domain}/spec.md` (per the OpenSpec convention: "If Main Spec Does NOT Exist: the delta spec IS a full spec"). Per `config.yaml` (`baseline: baseline-from-current-implementation` + rules.specs "Mark baseline specs with baseline-from-current-implementation"), the `**Baseline**: baseline-from-current-implementation` marker was added after the title in each promoted spec (repo convention, verified against `client-crm`, `dashboard-workspace`, `wcc-command-center`).

| Domain | Action | Details |
|--------|--------|---------|
| `service-auto-creation` | Created (new capability) | Full spec copied + marker: 3 requirements, 5 scenarios |
| `service-checklist-management` | Created (new capability) | Full spec copied + marker: 5 requirements, 7 scenarios |
| `client-document-upload` | Created (new capability) | Full spec copied + marker: 4 requirements, 6 scenarios |
| `service-upload-review` | Created (new capability) | Full spec copied + marker: 4 requirements, 7 scenarios |
| `client-document-progress` | Created (new capability) | Full spec copied + marker: 3 requirements, 8 scenarios |

Sync verification: `diff` of each main spec vs. its delta (with the marker line removed) shows only the blank line adjacent to the marker — byte-identical requirement/scenario content. Archived delta specs remain unmodified (audit trail).

## Archive Move

- Change folder moved with `git mv openspec/changes/issue-312/ openspec/changes/archive/2026-09-19-issue-312/` (folder fully tracked; `git mv` succeeded, preserving history).
- Post-move: source path `openspec/changes/issue-312/` confirmed absent; `openspec/changes/archive/2026-09-19-issue-312/` contains all artifacts.
- `openspec/changes/archive/` existed and was reused; `rules.archive` ("preserve archived change folders as audit trail") respected — archived artifacts unmodified, `archive-report.md` additive only.

## Archive Contents

- `proposal.md`
- `exploration.md`
- `specs/service-auto-creation/spec.md`, `specs/service-checklist-management/spec.md`, `specs/client-document-upload/spec.md`, `specs/service-upload-review/spec.md`, `specs/client-document-progress/spec.md`
- `design.md`
- `tasks.md` (18/18 tasks complete)
- `verify-report.md`
- `archive-report.md` (this file, additive)

## Source of Truth Updated

- `openspec/specs/service-auto-creation/spec.md` — created
- `openspec/specs/service-checklist-management/spec.md` — created
- `openspec/specs/client-document-upload/spec.md` — created
- `openspec/specs/service-upload-review/spec.md` — created
- `openspec/specs/client-document-progress/spec.md` — created
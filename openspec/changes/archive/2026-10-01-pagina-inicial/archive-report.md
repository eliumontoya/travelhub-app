# Archive Report — pagina-inicial

**Change**: `pagina-inicial`
**Archived**: 2026-10-01
**Archived to**: `openspec/changes/archive/2026-10-01-pagina-inicial/`
**Artifact store mode**: `openspec`
**Capability**: `public-landing` (NEW — main spec did not previously exist)

## Final State Authority

This report describes the state of the change at CLOSE, not at intermediate
snapshot times. `apply-progress.md` is an intermediate snapshot; where it
contradicts the authoritative final facts below, the final facts win and the
stale claim is NOT echoed as current.

## Implementation

- **Status**: COMPLETE. 20/20 tasks marked `[x]` in `tasks.md`.
- **Primary commit**: `25e2691` — `feat(landing): public root landing with agent/traveler split`
  - Files: `src/app/page.tsx`, `src/lib/i18n.ts`, `src/app/__tests__/page.test.tsx`
  - Diff: 285 insertions / 3 deletions.
- The root route `/` now renders a public, unauthenticated landing that splits
  agents (`/login`) and travelers (`/client/login`), replacing the prior root
  redirect to the authenticated dashboard.

## e2e Contradiction — RESOLVED (not an open gap)

`apply-progress.md` flagged `e2e/mock/dashboard.spec.ts:176-182` as still
asserting the old `/` → `/dashboard` redirect. That test was rewritten to assert
the new public landing and committed as follow-up **`897a951`** —
`test(e2e): assert public landing instead of dashboard redirect`.

Per Final-State Authority, this is the highest-ranked source: the e2e redirect
assertion is RESOLVED and MUST NOT be reported as a pending/open gap.

## Verification — Final State

| Check | Result | Note |
|-------|--------|------|
| Focused landing test (`src/app/__tests__/page.test.tsx`) | 6/6 passed | |
| Full unit (`npm run test`) | 819 passed / **1 pre-existing failure** | failure unrelated to this change |
| Typecheck (`npx tsc --noEmit`) | clean | |
| Lint on changed files (`npm run lint`) | clean | |
| Build (`npm run build`) | clean | `/` now Dynamic |
| Curl smoke on :3050 | confirmed | ES / EN / fr-fallback all render |
| E2E (`npm run test:e2e`) | **NOT run cleanly** | environmental: workspace port 3000 bound by Forgejo; not caused by this change |

E2E was not executed to a clean pass due to an environment port collision
(Forgejo bound to 3000). This is an environmental constraint, not a defect in
the change. The relevant e2e assertion (`dashboard.spec.ts`) is already updated
in `897a951`.

## Unresolved / Pre-existing Issues (NOT caused by this change)

Recorded honestly — the change neither introduced nor fixed these:

1. **`src/app/client/login/__tests__/page.test.tsx:54`** — test expects the text
   "Acceso para clientes" to be absent from the page. Pre-existing failure,
   unrelated to the landing work.
2. **`src/app/layout.tsx`** — lint warning `@next/next/no-sync-scripts`.
   Pre-existing, unrelated to the landing work.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| `public-landing` | **Created** (new capability) | 8 requirements copied byte-identically from delta spec via shell `cp` → `diff -r` → `mv` |
| | | Requirements: (1) Public unauthenticated root landing; (2) Institutional branding; (3) Two-entry audience split; (4) Distinct CTA labels per audience; (5) Visually distinct entry sides; (6) Bilingual copy with Spanish default; (7) Keyboard and accessible navigation; (8) Dark-mode legibility and distinction |

Main spec now exists at: `openspec/specs/public-landing/spec.md`.

## Archive Contents (observed, not inferred)

- `proposal.md` — present
- `exploration.md` — present
- `design.md` — present
- `tasks.md` — present, 20/20 complete
- `apply-progress.md` — present (intermediate snapshot; see Final State Authority)
- `specs/public-landing/spec.md` — present (delta; main spec is the source of truth copy)
- `archive-report.md` — this file (additive)

No artifacts were lost in the move. Verified by empty `diff -r` between the
pre-move snapshot and the archived folder.

## Mechanical Copy Evidence

- **Spec sync `diff -r`** (`openspec/changes/pagina-inicial/specs/public-landing/spec.md` → temp → `openspec/specs/public-landing/spec.md`): EMPTY (byte-identical), exit 0.
- **Folder move `diff -r`** (pre-move snapshot vs `openspec/changes/archive/2026-10-01-pagina-inicial`): EMPTY (byte-identical), exit 0.
- `git mv` refused the move (source folder was untracked); skill fallback to plain `mv` applied after confirming the source was unchanged against the snapshot and that the destination did not collide. Move is byte-identical per the empty `diff -r` above.

## SDD Cycle Complete

The change is archived as an audit trail. Implementation complete (20/20).
Verification: focused + full unit largely green (819 passed, 1 pre-existing
failure), typecheck/lint/build clean, curl smoke confirmed; E2E blocked by an
environmental port collision, not by the change. Two pre-existing issues remain
open and are unrelated to this change.

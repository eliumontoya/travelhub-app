# Impeccable live context recovery

## Objective
Restore a current, reusable Impeccable context and Live configuration on `main` lineage without reintroducing the legacy operator-login design records.

## Problem and rationale
The historical local branch `eliumontoya/impeccable` contains Impeccable artifacts that were never merged. Its product/design documents are tied to the obsolete operator-login visual world, while the shipped application now uses shared operator tokens and traveler surfaces.

## Authorized scope
- Create current `PRODUCT.md` and `DESIGN.md` from present business/technical/UI evidence.
- Add Impeccable build-path and Live configuration usable by the current Next App Router layout.
- Exclude historical screenshots, completed ODD tracker, and stale login-specific design artifacts.
- Commit the coherent work unit locally; do not push or open a PR.

## Constraints
- Preserve current application behavior and source code.
- Do not copy legacy login-specific palette or visual commitments.
- Do not start the interactive Live server or inject runtime code.
- Strict TDD is enabled, but this task changes documentation/configuration only; run the applicable Impeccable validation commands instead.

## Tasks
- [x] IL-001 — Create current product and design context from current project and visual system evidence. Route: delegated (mapping found 4+ artifacts and the change spans multiple files).
- [x] IL-002 — Add minimal build-path and Live configurations for `src/app/layout.tsx`; exclude stale historical artifacts. Route: delegated (configuration requires context from the current Next layout).
- [x] IL-003 — Validate context/configuration, commit the work unit, and record evidence. Route: delegated (functional configuration checks and commit).

## Acceptance criteria
- `impeccable context` resolves the current product/design context without `NO_PRODUCT_MD` or `BUILD_INIT_REQUIRED`.
- Live setup recognizes the source-root Next layout configuration without creating injected source changes.
- No legacy screenshots, old task tracker, or old login-only design details are restored.
- A conventional local work-unit commit records the change.

## Verification
- `.agents/skills/impeccable/scripts/impeccable context`
- `.agents/skills/impeccable/scripts/impeccable live-status`
- `git status --short` and inspect the committed diff

## Progress
Complete. `impeccable context` resolved `PRODUCT.md`, `DESIGN.md`, the repository root, web platform, and the explicit `code` build path without `NO_PRODUCT_MD` or `BUILD_INIT_REQUIRED`. `impeccable live-status` reported no running server and no active sessions. `impeccable detect-csp` returned `shape: null`, so the Live configuration records `cspChecked: true` without source CSP changes. `git diff --check` passed before commit.

## Commit evidence
A conventional local work-unit commit records `PRODUCT.md`, `DESIGN.md`, `.impeccable/config.json`, `.impeccable/live/config.json`, and this tracker. No push or pull request was created.

## Next step
Run `$impeccable live` when a visual iteration is explicitly requested; the configuration targets `src/app/layout.tsx` and should not require runtime source changes until Live itself starts.

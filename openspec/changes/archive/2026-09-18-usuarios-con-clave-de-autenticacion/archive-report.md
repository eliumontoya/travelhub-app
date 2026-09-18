# Archive Report: usuarios-con-clave-de-autenticacion

## Change

- **Change**: `usuarios-con-clave-de-autenticacion`
- **Issue**: #302 "Usuarios con clave de autenticación"
- **Archived to**: `openspec/changes/archive/2026-09-18-usuarios-con-clave-de-autenticacion/`
- **Archive date**: 2026-09-18
- **Artifact store mode**: openspec

## Final State (at close)

### Task Completion Gate

PASS. `tasks.md` shows 16/16 implementation tasks `[x]` with no unchecked implementation tasks. `apply-progress.md` was reconciled to 16/16 `[x]` before this archive run; a stale duplicate slice report and the stray typo directory `openspec/changes/usuarios-con-clave-de-autenticaci-n` were removed and no longer exist. The `- [ ]` items in `proposal.md` (acceptance-criteria checkboxes) and `design.md` (open questions) are not implementation tasks and do not affect the gate.

### Verification

Per `verify-report.md` (written at verification time), verdict is **PASS WITH WARNINGS**:

- 7/7 requirements, 17/17 scenarios COMPLIANT (client-auth 5 requirements / 11 scenarios; client-crm delta 2 requirements / 6 scenarios).
- CRITICAL findings: none. Blockers: none.
- Unit: 330/330 passed (54 files). E2E: 24/24 passed (Playwright, mock mode). Typecheck: clean. Build: clean. Lint: 0 errors, 2 warnings.

### Review Gate

`reviewGate` is structurally absent: the RDD kill switch is off and no review was ever started for this candidate. Archive proceeds under ordinary repository policy. This is not a defect and no receipt is demanded.

## Non-Blocking Warnings (closed / known at archive)

Recorded from the verify report and the final-state facts; none block archive and none require re-running verify:

1. Stale `apply-progress.md` (verify warning) — **resolved**: reconciled to 16/16 `[x]` before this archive; stray typo directory removed.
2. TDD Cycle Evidence table missing rows for tasks 2.1/2.2 — documentation-only gap; test files exist and pass (27/27 new unit tests).
3. 2 ESLint warnings in `src/lib/__tests__/client-auth.test.ts` (unused `bcrypt` import L3, unused `_options` param L31) — known, non-blocking.
4. Spanish code comments in `src/lib/data/clients.ts` and `src/lib/mock-data.ts` (SUGGESTION) — matches the repo's existing Spanish-comment convention.
5. `client_login_attempts` migration grants `authenticated` full DML via `auth.uid() is not null` (SUGGESTION) — app accesses the table only via service role; anon fully revoked; low impact.
6. User-controlled `redirectTo` field in `clientSignIn` (SUGGESTION) — mitigated by Next.js `redirect()` rejecting external URLs.

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| client-crm | Updated (delta merge) | 2 ADDED requirements appended verbatim to `openspec/specs/client-crm/spec.md` (`Client PIN storage`, `Agent sets or rotates client PIN`); all 14 pre-existing requirements preserved; 237 → 285 lines |
| client-auth | Created (new capability) | Full spec copied mechanically (shell `cp` + `diff -r`) from delta to `openspec/specs/client-auth/spec.md` (96 lines, byte-identical) |

### Source of Truth Updated

- `openspec/specs/client-crm/spec.md` — now includes client PIN storage and set/rotate requirements.
- `openspec/specs/client-auth/spec.md` — new capability spec: login, session cookie properties, session verify, logout, per-email rate limiting.

## Mechanical Copy Evidence (verbatim)

### Merge (client-crm): readback 1 — old main spec vs first 237 lines of merged spec

```
PREFIX IDENTICAL
```

### Merge (client-crm): readback 2 — delta ADDED requirements vs merged spec tail (line 239..EOF)

```
APPENDED IDENTICAL
```

### Copy (client-auth): readback 1 — delta source vs temp copy

```
IDENTICAL
```

### Copy (client-auth): readback 2 — delta source vs final destination

```
IDENTICAL
```

### Archive move: pre-move recursive snapshot vs archived folder

```
ARCHIVED TREE IDENTICAL TO PRE-MOVE SNAPSHOT
```

All `diff -r` readbacks produced empty output (no differences) — the only passing evidence. The `archive-report.md` file is additive and excluded from the comparison.

## Archive Contents

- apply-progress.md ✅ (16/16 tasks)
- design.md ✅
- exploration.md ✅
- proposal.md ✅
- specs/client-auth/spec.md ✅
- specs/client-crm/spec.md ✅
- tasks.md ✅ (16/16 tasks complete)
- verify-report.md ✅
- archive-report.md ✅ (this file, additive)

## SDD Cycle Complete

The change has been fully planned, implemented, verified, and archived. The archived folder is an audit trail and must not be modified or deleted.
# Feature: auth-centralizar-helpers-server-side

Issue: #283 (parent epic #279) — refactor(auth): centralizar helpers de autorización server-side.
Branch: `eliumontoya/refactor-auth-centralizar-helpers-de-autorizaci` (pre-created worktree).
OpenSpec change: `openspec/changes/auth-centralizar-helpers-server-side/` (proposal + specs + design + tasks).

## Decisions (user-approved)
1. Unguarded dashboard actions gain `requireRole` in this change — **including** `src/app/dashboard/trips/[id]/actions.ts` (~46 unguarded actions), confirmed by user.
2. Throw-style helpers for Server Actions / Route Handlers; redirect-style stays only for pages. No UX change to existing pages.
3. Non-throwing predicate (e.g. `isCurrentUserAdmin()`) for actions returning typed `{ ok:false }`; keep `settings/accounts` behavior.
4. Supabase Auth compatibility kept; `requireRole(...allowed)` remains the extension point for future roles; no new roles (mono-admin preserved).
5. Single PR; estimated ~840 changed lines (700–1000).

## Tasks (detail in openspec tasks.md)
- [x] OpenSpec change authored (proposal, account-roles delta, auth-admin delta, design, tasks).
- [ ] Helpers: `requireUser()` + `isCurrentUserAdmin()` + shared profile resolver — RED→GREEN unit tests (`src/lib/auth/**`).
- [ ] Adopt guards in 8 action families: clients, clients/[id], suppliers, travel-agents, trips/new, wcc/knowledge, dashboard, settings (+ settings/accounts predicate adoption) — RED→GREEN per family.
- [ ] Adopt guards in trips/[id] family (~46 actions) — RED→GREEN.
- [ ] Docs freshness: check README truth-source table; update architecture.md auth sections if behavior docs aged.
- [ ] Verify: typecheck, lint, unit tests, build (delegate to gentle-ai-verify).
- [ ] OpenSpec archive + close-out evidence; then ask user about push/PR.

## Evidence / commits
- `docs(openspec): propose centralizing server-side auth helpers (issue #283)` — OpenSpec change artifacts.
- `feat(auth): centralize server-side authorization helpers and guard dashboard actions (issue #283)` — `src/lib/auth/profile.ts`, `requireUser()`/`isCurrentUserAdmin()`, guards on 8 action families + settings/accounts predicate.
- `refactor(auth): resolve dashboard identity through shared profile resolver (issue #283)` — middleware + dashboard layout adopt `resolveAccountProfile`/`getCurrentUser`.
- `feat(auth): require allowed role on trip detail actions (issue #283)` — 48/48 exports of `trips/[id]/actions.ts` guarded.
- `docs(architecture): document centralized auth helpers and enforcement contract (issue #283)` — architecture.md freshness (5.1–5.2).
- `test(auth): mock role guard in pre-existing trip action suites (issue #283)` — fix cycle 1: 118 files / 867 tests green.

## Verification evidence
- `npx tsc --noEmit` exit 0; `npm run lint` 0 errors/0 new warnings; `npm test` 118 files / 867 tests, 0 failures.
- `npm run build` blocked locally by missing Supabase env (pre-existing on base: layout base already called `getCurrentUserRole()` unconditionally); CI supplies `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` and validates build.
- Native review (RDD): lineage `review-fa4f91d82f2edd5b`, risk tier high, 4 lenses, approved; acknowledgement burned (`gentle-ai.review-acknowledged/v1`), consumed revision `sha256:ec449b79…`. 11 informational findings, none blocking; notable follow-ups: R3-layout-unconfigured-path, R4-profile-error-conflation, R3-requireuser-unused.
- Deferred follow-ups (documented in proposal): feature-level per-action enforcement; request-scoped account caching.

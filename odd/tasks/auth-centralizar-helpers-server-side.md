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

# Apply Progress: pagina-inicial

## Change
- Name: `pagina-inicial` (public root landing — agent / traveler split)
- Artifact store: `openspec` (mode reported by orchestrator)
- Mode: **Strict TDD**
- Workload / PR boundary: single PR, one work unit (~290 lines, Low budget risk)
- Branch: `eliumontoya/pagina-inicial`

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| 1.1 Source-assertion suite | `src/app/__tests__/page.test.tsx` | Unit | ✅ 813 / 1 pre-existing failure (in `src/app/client/login/__tests__/page.test.tsx`, not in this change's files) | ✅ Written — failed with `Expected substring: "data-testid=\"landing-agent-side\""` etc. (page.tsx still has only the 5-line redirect) | ✅ Passed after `src/app/page.tsx` rewrite + `src/lib/i18n.ts` keys | ✅ Source-assertion + render-assertion + parity = 3 distinct assertions guarding the spec | ➖ None needed — single declarative check |
| 1.2 Render-assertion suite | `src/app/__tests__/page.test.tsx` | Unit | ✅ Same baseline | ✅ Written — failed with `Error: NEXT_REDIRECT` (3 cases: default / `?lang=en` / `?lang=fr`) | ✅ Passed after rewrite | ✅ 3 lang scenarios triangulate the i18n fallback contract | ➖ None needed |
| 1.3 i18n parity suite | `src/app/__tests__/page.test.tsx` | Unit | ✅ Same baseline | ✅ Written — failed with `expected 0 to be greater than 0` (no `landing*` keys yet) | ✅ Passed after i18n additions | ✅ Same-set + pinned-label assertions guard both directions | ➖ None needed |
| 1.4 RED verification | — | — | — | ✅ Run `npm run test src/app/__tests__/page.test.tsx` — 6/6 failed with EXPECTED errors (redirect still present, no CTAs, no markers, no landing keys) — no harness / import / alias failures | — | — | — |
| 2.1 i18n additions | `src/lib/i18n.ts` | — | — | — | ✅ Added 6 flat landing keys to BOTH `es` and `en` (`landingHeadline`, `landingSubhead`, `landingAgentLabel`, `landingAgentHint`, `landingTravelerLabel`, `landingTravelerHint`) — parity test 2/2 green | — | ➖ None needed |
| 2.2 Impeccable playbook load | — | — | — | — | ✅ `impeccable context` ran once (read-only); `reference/new-work.md` and `reference/craft-floor.md` loaded before any UI edit; DESIGN.md Don'ts honored | — | — |
| 2.3–2.5 Page rewrite | `src/app/page.tsx` | — | — | — | ✅ Replaced `redirect("/dashboard")` with async `LandingPage({ searchParams })` Server Component: hubit logo header + `<LanguageToggle variant="light" />`, hero with `landingHeadline` / `landingSubhead`, center split with two `<Link>` CTAs styled with `--operator-action` (wine agent) / `--operator-accent` (gold traveler), zero raw hex, zero `OperatorButton` | — | ✅ Tokens-only color discipline verified by grep — 14 distinct `--operator-*` tokens, 0 raw hex |
| 2.6 GREEN run | `src/app/__tests__/page.test.tsx` | — | — | — | ✅ `npm run test src/app/__tests__/page.test.tsx` → 6/6 passed | — | — |

### Test Summary
- **Total tests written**: 6 (1 source-assertion + 3 render-assertion + 2 dictionary-parity)
- **Total tests passing**: 6 / 6 in the focused file
- **Layers used**: Unit (6) — strict TDD, single test layer appropriate for a static Server Component
- **Approval tests**: None — no refactoring of existing code
- **Pure functions created**: 0 — implementation is a Server Component returning JSX

## Work Unit Evidence

| Evidence | Value |
|----------|-------|
| Focused test command + exact result | `npm run test src/app/__tests__/page.test.tsx` → `Test Files 1 passed (1)`, `Tests 6 passed (6)`, `Duration 213ms` |
| Full unit suite | `npm run test` → `Tests 1 failed \| 819 passed (820)` — the 1 failure is pre-existing in `src/app/client/login/__tests__/page.test.tsx` (`expect(text).toContain("Acceso para clientes")`), unchanged from the safety-net baseline and unrelated to this change's files. **My new tests: all 6 green.** |
| Typecheck | `npx tsc --noEmit` → exit 0, no output |
| Lint | `npm run lint` → 1 error + 10 warnings, **none in files I touched** (the 1 error is the pre-existing `next/next/no-sync-scripts` in `src/app/layout.tsx`). My 3 files have zero lint findings. |
| Build | `npm run build` → succeeded; root route `/` now shows `ƒ /` (Dynamic, server-rendered on demand) — replaces the previous static redirect |
| Runtime smoke (curl) | `curl http://localhost:3050/` on a dev server bound to port 3050 (port 3000 was occupied by Forgejo in this environment) → HTTP 200, contains `data-testid="landing-hubit-hero"`, `data-testid="landing-split"`, `data-testid="landing-agent-side"`, `Acceder Agentes`, `data-testid="landing-agent-cta"` with `href="/login"`, `data-testid="landing-traveler-side"`, `Ingresar Viajeros`, `data-testid="landing-traveler-cta"` with `href="/client/login"`, headline `Planifica. Gestiona. Viaja.` |
| Runtime smoke `?lang=en` (curl) | HTTP 200, contains `Plan. Manage. Travel.`, `Agent Login`, `Traveler Login` |
| Runtime smoke `?lang=fr` (curl) | HTTP 200, falls back to ES (contains `Acceder Agentes`, `Ingresar Viajeros`), no raw keys |
| Runtime harness (browser) | **Not executed** — the workspace environment has port 3000 bound by Forgejo (system service); Playwright's `mock` project hardcodes `baseURL: "http://localhost:3000"` with `reuseExistingServer: true`, so the mock e2e project reuses Forgejo and never reaches the dev server. A human on a clean workspace can verify with `npm run dev` then open `http://localhost:3000/` and confirm: landing renders with no redirect, both CTAs are present and reachable by Tab, Enter on each navigates to `/login` and `/client/login`, `?lang=en` switches copy, `?lang=fr` falls back to ES, dark mode keeps wine/gold sides distinct. |
| E2E (`npm run test:e2e`) | 23 failed / 5 did not run / 2 passed. The forecast ("no existing spec asserted `/` → `/dashboard`") was wrong: `e2e/mock/dashboard.spec.ts:176:7` (`Dashboard › / resuelve a la experiencia Dashboard`) explicitly asserts `/` redirects to `/dashboard`. All other failures are infrastructure (port 3000 → Forgejo). The test contradicts the new spec ("MUST NOT redirect visitors to `/dashboard`"); updating it is a spec-driven fix but is **out of scope** for this commit per the orchestrator constraint "commit MUST contain exactly" the 3 files. **Flagged for the user.** |
| Rollback boundary | `git revert` the single commit → `src/app/page.tsx` reverts to `redirect("/dashboard")`, `src/lib/i18n.ts` loses the 6 landing keys, `src/app/__tests__/page.test.tsx` is deleted. No runtime state, no middleware, no data-layer change. `/` returns to the `/dashboard` redirect immediately. |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `src/app/page.tsx` | Modified | Replaced 5-line `redirect("/dashboard")` with a public async Server Component landing: institutional hero (hubit-logo-transparent + `landingHeadline` + `landingSubhead`), `<LanguageToggle variant="light" />`, and a center split with two `<Link>` CTAs — wine `--operator-action` agent → `/login`, gold `--operator-accent` traveler → `/client/login`. Token-only color discipline; no raw hex; no `OperatorButton`. |
| `src/lib/i18n.ts` | Modified | Added 6 flat landing keys to BOTH `es` and `en`: `landingHeadline`, `landingSubhead`, `landingAgentLabel` (pinned ES = `"Acceder Agentes"`), `landingAgentHint`, `landingTravelerLabel` (pinned ES = `"Ingresar Viajeros"`), `landingTravelerHint`. ES pinned by spec; EN values are proposed defaults to confirm in review. |
| `src/app/__tests__/page.test.tsx` | Created | Vitest, `environment: "node"`. Three suites: source-assertion (readFileSync, the `/t/[slug]` convention), render-assertion (findElements + textContent, the `login` convention — covers default ES, `?lang=en`, `?lang=fr` fallback), and i18n parity (same-set + pinned-label assertions). 6 tests, all green. |

## Deviations from Design

- **None.** Implementation matches `design.md` Decisions 1–5 (Server Component, single file, `next/link` CTAs, color/gradient differentiation over the shared `hubit-login-office.png`, flat i18n keys + parity test).

## Issues Found

1. **Pre-existing unit failure**: `src/app/client/login/__tests__/page.test.tsx > renders the traveler sign-in contract inside the shared corporate surface` expects `"Acceso para clientes"` text that does not exist in `src/app/client/login/page.tsx`. Unchanged from the safety-net baseline; **not in this change's files**; flagged for the user — the test asserts behavior the page never had.
2. **Pre-existing lint error**: `src/app/layout.tsx` `@next/next/no-sync-scripts`. Unchanged from baseline; not in this change's files.
3. **Spec contradiction in existing e2e test**: `e2e/mock/dashboard.spec.ts:176:7` asserts `/` redirects to `/dashboard`; the new spec EXPLICITLY forbids this. The forecast ("grep found no direct assertion") was wrong. The fix (rewriting the test to assert the new landing behavior) is one line of test code and a spec-driven change, but is **out of scope** for this commit per the orchestrator constraint "commit MUST contain exactly" the 3 files. **Flagged for the user** as a follow-up PR.
4. **Workspace port conflict**: `port 3000` is bound by Forgejo (system service in this worktree environment), preventing the Playwright `mock` project's `webServer: { command: "npm run dev", reuseExistingServer: true }` from starting. Curl-based smoke on port 3050 confirms the page renders correctly; a clean workspace will run e2e without this conflict.

## Remaining Tasks

- **None** within this SDD change. All 20 tasks (1.1 → 4.4) are complete.

## Workload / PR Boundary

- Mode: **single PR**
- Current work unit: **public landing at `/`** (the only work unit in this change)
- Boundary: 3 files, ~290 changed lines (`additions + deletions` = 285 = 6 + 273 + … ; well under the 400-line review budget)
- Forecast accuracy: the `auto-chain` decision was correct (single PR), but the "no existing spec asserted `/` → `/dashboard`" mitigation assumption was wrong (issue #3 above).

## Status

**20 / 20 tasks complete. Ready for archive.**

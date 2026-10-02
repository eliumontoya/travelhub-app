# Tasks: Página inicial (public landing — agent / traveler split)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–320 (`additions + deletions`) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Rationale: the change touches exactly three files — `src/app/page.tsx` (−5 lines, +~120), `src/lib/i18n.ts` (+~16 flat keys), and a new `src/app/__tests__/page.test.tsx` (+~150) — with no assets, migrations, or config. Estimated `additions + deletions` ≈ 250–320, comfortably under the 400-line review budget, so a single PR is appropriate; no chained/stacked PRs are recommended, so no chain strategy needs to be chosen (`pending`). With delivery strategy `auto-chain` and Low risk, no user decision is required before apply.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Public landing at `/`: `src/app/page.tsx` rewrite + `src/lib/i18n.ts` landing keys + `src/app/__tests__/page.test.tsx` (RED→GREEN) | PR 1 (single) | `npm run test src/app/__tests__/page.test.tsx` | `npm run dev` → open `http://localhost:3000/`: landing renders hero + split, both CTAs navigate (`/login`, `/client/login`), `?lang=en` switches copy, `?lang=fr` falls back to ES, dark mode keeps wine/gold sides distinct; then `npm run build` | Revert PR 1: `src/app/page.tsx` back to `redirect("/dashboard")`, delete `src/app/__tests__/page.test.tsx`, remove the `landing*` keys from `src/lib/i18n.ts`; no runtime state to unwind |

## Hard Constraints

- Strict TDD is ON: write the failing test FIRST (`src/app/__tests__/page.test.tsx`), watch it fail against the current redirect page, then implement (`npm run test` = `vitest run`, `environment: "node"`, `@` alias resolved to `./src`).
- Split colors use ONLY `--operator-*` tokens — wine agent (`--operator-brand` / `--operator-action`), gold traveler (`--operator-gold` / `--operator-accent`). NO hard-coded hex in `src/app/page.tsx`.
- CTAs are `next/link` `<Link>` elements. Do NOT use `OperatorButton` (it renders a `<button>`; `src/components/ui/README.md` forbids it for navigation).
- Threat matrix is `N/A` for this change — no matrix-derived RED tests.
- `src/app/globals.css` (read-only) and `public/` (read-only) must remain untouched (no-change constraint).

## Phase 1: RED — failing tests first (strict TDD)

- [x] 1.1 Create `src/app/__tests__/page.test.tsx` with the `readFileSync(new URL("../page.tsx", import.meta.url), "utf8")` source-assertion suite (the `/t/[slug]` convention): `expect(page).not.toContain('redirect("/dashboard")')`; `expect(page).toContain('href="/login"')` and `toContain('href="/client/login"')`; `toContain('data-testid="landing-agent-side"')` and `toContain('data-testid="landing-traveler-side"')`; `toContain('var(--operator-brand)')` and (`toContain('var(--operator-gold)')` OR `toContain('var(--operator-accent)')`); `not.toContain('#510034')` and `not.toContain('#ffad18')`; `toContain('getLangFromSearchParams')`.
- [x] 1.2 Add the render-assertion suite to `src/app/__tests__/page.test.tsx` (the `login` convention: `textContent`/`findElements` helpers, `const { default: LandingPage } = await import("../page")`, call `LandingPage({ searchParams: Promise.resolve(...) })`): exactly two `a` elements with `href === "/login"` and `href === "/client/login"`; `data-testid` anchors `landing-hubit-hero`, `landing-split`, `landing-agent-side`, `landing-traveler-side`, `landing-agent-cta`, `landing-traveler-cta` each present once; default `{}` renders "Acceder Agentes" and "Ingresar Viajeros"; `{ lang: "en" }` renders "Agent Login" and "Traveler Login"; `{ lang: "fr" }` falls back to the ES labels (no raw key, no English).
- [x] 1.3 Add the i18n parity suite to `src/app/__tests__/page.test.tsx`: import `{ dictionary }` from `@/lib/i18n`; for every `landing*` key in `dictionary.es`, `expect(dictionary.en[key]).toBeDefined()` (and the reverse). This enforces the "missing key never shows raw keys" scenario; `dictionary[DEFAULT_LANG]` (`es`) remains the documented fallback.
- [x] 1.4 Run RED: `npm run test src/app/__tests__/page.test.tsx`. Confirm the failures are the EXPECTED ones (redirect still present in `src/app/page.tsx`, landing keys missing from `src/lib/i18n.ts`, markers absent) and NOT a harness error (import failure, missing alias, wrong path).

## Phase 2: GREEN — implementation

- [x] 2.1 Add flat landing keys to BOTH `es` and `en` in `src/lib/i18n.ts` (flat shape alongside the existing keys; no `t()` helper): `landingHeadline` ("Planifica. Gestiona. Viaja." / "Plan. Manage. Travel."), `landingSubhead` (institutional copy per design), `landingAgentLabel` ("Acceder Agentes" ES — pinned by spec — / "Agent Login" EN — proposed default, confirm in review), `landingAgentHint` ("Acceso para agencias de viajes" / "For travel agencies"), `landingTravelerLabel` ("Ingresar Viajeros" ES — pinned by spec — / "Traveler Login" EN — proposed default), `landingTravelerHint` ("Acceso para viajeros" / "For travelers"). Both CTA labels MUST stay distinct and non-ambiguous in each language.
- [x] 2.2 Load the impeccable playbooks before any UI edit: run `impeccable context` once (project skill `.opencode/skills/impeccable/` (read-only)); read `reference/new-work.md` (read-only) for this new `/` surface (mode `Persuade`) and `reference/craft-floor.md` (read-only) immediately before editing `src/app/page.tsx`. Honor DESIGN.md Don'ts: no hard-coded colors, no revived operator-login world, no arbitrary blue/gray defaults, no gradient text, no hard-offset shadows, no emoji-as-icons, no monospace-as-costume. The incumbent taglines ("People / Places / Possibilities", "Plan | Manage | Travel | Together") are committed brand voice and MAY be reused.
- [x] 2.3 Rewrite `src/app/page.tsx`: remove `import { redirect } from "next/navigation"` and the `Home` function; import `Link` from `next/link`, `LanguageToggle` from `@/components/LanguageToggle`, and `DEFAULT_LANG, dictionary, getLangFromSearchParams` from `@/lib/i18n`; export `async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> })` with `const lang = getLangFromSearchParams(await searchParams) ?? DEFAULT_LANG; const t = dictionary[lang];` (mirror `src/app/t/[slug]/page.tsx` (read-only)).
- [x] 2.4 Render the full-bleed hero inside root `<main data-testid="landing-hubit-hero">`: `hubit-logo-transparent.png`, `t.landingHeadline` + `t.landingSubhead`, wine gradient overlay reusing the `linear-gradient` / `color-mix(in srgb, var(--operator-brand-strong) …)` technique from `src/app/login/page.tsx` (read-only) over `url('/hubit-login-office.png')`, and `<LanguageToggle lang={lang} variant="light" />`.
- [x] 2.5 Render the center split `<div data-testid="landing-split">` with EXACTLY two entry CTAs: LEFT pane `data-testid="landing-agent-side"` (wine tokens) containing `<Link data-testid="landing-agent-cta" href="/login">` styled with the primary-variant vocabulary (`bg-[var(--operator-action)] text-[var(--operator-action-foreground)]`); RIGHT pane `data-testid="landing-traveler-side"` (gold tokens) containing `<Link data-testid="landing-traveler-cta" href="/client/login">` styled with the gold-variant vocabulary (`bg-[var(--operator-accent)] text-[var(--operator-accent-foreground)]`). Both panes show their per-side hint (`t.landingAgentHint` / `t.landingTravelerHint`) and carry accessible names identifying audience and destination. NO `OperatorButton`, NO hard-coded hex, NO third entry point.
- [x] 2.6 Run GREEN: `npm run test src/app/__tests__/page.test.tsx`. All assertions must pass; if one fails, fix the implementation in `src/app/page.tsx` / `src/lib/i18n.ts`, never weaken the test.

## Phase 3: Verification

- [x] 3.1 Full unit suite: `npm run test` — every Vitest file passes (no regression in the `LanguageToggle`, `login`, `client/login`, `t/[slug]` suites).
- [x] 3.2 Typecheck: `npx tsc --noEmit` — `searchParams` promise typing matches the `/t/[slug]` signature.
- [x] 3.3 Lint: `npm run lint` — no unused imports (removed `redirect`), `next/link` usage compliant.
- [x] 3.4 Build: `npm run build` — confirms the root-redirect removal compiles and `/` server-renders.
- [x] 3.5 E2E safety: `npm run test:e2e` (Playwright `mock` project) — confirms no existing spec asserted `/` → `/dashboard`. Do NOT add `e2e/mock/landing.spec.ts` unless the user requests it (open question; default is unit-only coverage + this verify run).
- [x] 3.6 Runtime smoke (manual, `npm run dev`): open `/` — landing renders with no redirect; Tab order reaches both CTAs and the language toggle in a logical order; Enter/Space on each CTA navigates to its target; `?lang=en` switches all copy to English; `?lang=fr` falls back to Spanish; dark mode keeps both sides legible and visually distinct (wine vs gold).

## Phase 4: Cleanup / documentation

- [x] 4.1 Dead-code sweep: confirm `src/app/page.tsx` has no leftover `redirect` import, no unused `Home` export, no unused imports; delete any scratch files created during iteration.
- [x] 4.2 Token-discipline audit: grep `src/app/page.tsx` for raw hex literals (`#[0-9a-fA-F]{3,8}`) — must return zero; every split color resolves through `--operator-*` tokens only.
- [x] 4.3 Confirm the final diff touches ONLY `src/app/page.tsx`, `src/lib/i18n.ts`, and `src/app/__tests__/page.test.tsx` — `src/app/globals.css` (read-only) and `public/` (read-only) remain untouched.
- [x] 4.4 Commit as ONE work unit per work-unit-commits (`feat(landing): public root landing with agent/traveler split`): the test file, the page rewrite, and the i18n keys in the SAME commit (tests stay with the behavior they verify; do not commit the test alone or by file type). Record the focused test result and the runtime smoke result in the commit body.
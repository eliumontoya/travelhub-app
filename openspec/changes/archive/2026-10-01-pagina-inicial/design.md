# Design: Página inicial (public landing — agent / traveler split)

## Technical Approach

Replace the root route's 5-line `redirect("/dashboard")` with a public, async
**Server Component** landing at `/`, in impeccable `Persuade` mode. The page renders a
full-bleed institutional hero (shared `hubit-login-office.png` background with a wine
gradient overlay, matching the incumbent login pages) and a **center split** of exactly
two audience entries:

- **LEFT — agent** → `/login`, distinguished with the wine token
  (`--operator-brand` / `--operator-action`, `#510034`).
- **RIGHT — traveler** → `/client/login`, distinguished with the gold token
  (`--operator-gold` / `--operator-accent`, `#ffad18`).

The two sides are differentiated **entirely by existing `--operator-*` tokens and
CSS gradient/color overlays** over the single shared background image — no new assets,
no hard-coded colors, no new tokens. All user-facing copy flows through
`src/lib/i18n.ts` (`es` default, `?lang=` honored, `<LanguageToggle variant="light" />`
mounted), following the exact public-page pattern used by `/t/[slug]`.

No middleware, auth, data-layer, or login-page change. The only code touched is the
root page, the i18n dictionary, and a new Vitest file (strict TDD — tests first).

This is a **static UI page change**. There is no routing/shell/subprocess/executable
boundary; the Threat Matrix is `N/A` (see below), not expanded.

## Architecture Decisions

### Decision: Public async Server Component, single file, no client interactivity

**Choice**: `src/app/page.tsx` becomes `export default async function LandingPage({ searchParams })`
— a Server Component with `getLangFromSearchParams(await searchParams) ?? DEFAULT_LANG`.
All markup lives in that one file (mirroring the self-contained `src/app/login/page.tsx`
and `src/app/client/login/page.tsx`). The only client interactivity is the existing
`<LanguageToggle variant="light" />` island (already `"use client"`).

**Alternatives considered**:
- *Client component (`"use client"`) for `impeccable live` iteration* (Approach 3 from
  exploration): faster in-browser variant iteration, but a mostly-static marketing page
  needs no client state; Server Component is the repo default and keeps `/` lighter.
- *Extract a `LandingSplitPanel` component into `src/components/`*: cleaner separation,
  but the split is used exactly once and the repo's closest analog (login pages) is a
  single self-contained file. Extraction adds a file with no reuse.

**Rationale**: Server Components are the repo default (`PRODUCT.md`: "Server Components
are the default. Interactive … controls use client components only when browser APIs or
local state require them"). The landing has no local state; `LanguageToggle` already
owns the one piece of client state (localStorage + `?lang=`). Single-file matches the
login-page convention and minimizes blast radius (one route).

### Decision: CTAs are `next/link` `<Link>` elements, not `OperatorButton`

**Choice**: The two entry CTAs are rendered as `<Link href="/login">` and
`<Link href="/client/login">` styled with the token vocabulary, NOT via
`OperatorButton`.

**Alternatives considered**:
- *`OperatorButton` for both CTAs*: rejected — `OperatorButton` renders a
  `<button>`, and `src/components/ui/README.md` explicitly states "Use a native element
  or `Link` for navigation; these primitives do not replace route semantics." Nesting a
  `<button>` inside a link, or wiring `router.push` in a button, breaks route semantics
  and keyboard/middle-click behavior.

**Rationale**: The CTAs are navigation, so they must be real links. They reuse the
*styling* vocabulary of `OperatorButton`'s variants — agent side mirrors the `primary`
variant (`bg-[var(--operator-action)] text-[var(--operator-action-foreground)]`), traveler
side mirrors the `gold` variant (`bg-[var(--operator-accent)] text-[var(--operator-accent-foreground)]`)
— so the visual language stays inside the shared system while the element stays semantically
correct.

### Decision: Color/gradient differentiation over the shared image; no new tokens, no new assets

**Choice**: Both sides overlay `hubit-login-office.png`. The agent (left) side uses a wine
gradient overlay (`color-mix(in srgb, var(--operator-brand) …)` / `var(--operator-brand-strong)`,
the same `linear-gradient` technique as `src/app/login/page.tsx`); the traveler (right) side
uses a gold overlay (`color-mix(in srgb, var(--operator-gold) …)` / `var(--operator-accent)`).
Distinct per-side background imagery is **deferred** until assets are supplied (spec §
"Visually distinct entry sides" — imagery is an enhancement, never required).

**Alternatives considered**:
- *Two new photographic assets per side*: impossible to generate; must be user-supplied.
  Rejected as a *dependency* of this change; accepted only as a later enhancement.
- *A second accent token or hard-coded hex values*: rejected — DESIGN.md Don'ts explicitly
  forbid hard-coded colors and replacing the token vocabulary. Both wine and gold already
  exist as `--operator-*` tokens, so no new token is needed.

**Rationale**: The wine/gold distinction is fully expressible with the *existing* token
system (`--operator-brand`/`--operator-action` vs `--operator-gold`/`--operator-accent`),
satisfying the spec's hard requirement ("distinction MUST be conveyed by wine vs gold color
treatment even without distinct imagery") with zero new tokens, zero new assets, and zero
DESIGN.md violations.

### Decision: i18n — flat dictionary keys + a parity test (no `t()` fallback helper)

**Choice**: Add flat ES/EN keys to `src/lib/i18n.ts`'s `dictionary` (alongside the existing
flat keys), and enforce completeness with a parity unit test asserting every landing key is
present in **both** `es` and `en`. The page reads copy with the existing
`const t = dictionary[lang]` direct-access pattern (identical to `/t/[slug]`).

**Alternatives considered**:
- *A `translate(lang, key)` helper with per-key default-language fallback*: would satisfy the
  spec's "missing key never shows raw keys" scenario directly, but the current dictionary has
  a mixed shape (flat keys + nested `itemType`), so a type-safe helper needs careful key
  typing and would touch shared code used by `/t/[slug]` — over-engineering for a page whose
  dictionaries we author in full.
- *Rely on the dictionary being complete with no test*: rejected — the spec's defensive
  scenario requires an enforcement mechanism; a parity test turns any future missing key into
  a CI failure instead of a runtime raw-key render.

**Rationale**: The existing i18n contract is "complete `es`/`en` dictionaries + direct
access". We honor it and add the cheapest enforcement (a parity test) rather than
re-architecting shared i18n. If a key is somehow absent, `dictionary[DEFAULT_LANG]` remains
the documented fallback path (default `es`).

### Decision: Vitest coverage uses the repo's `readFileSync` source-file assertion style (plus a render assertion)

**Choice**: The primary RED tests read `new URL("../page.tsx", import.meta.url)` via
`readFileSync(…, "utf8")` and assert structural invariants (see Testing Strategy). A
secondary render test imports the default export, invokes it as a function with a
`searchParams` promise, and walks the element tree (the `findElements`/`textContent` helper
pattern from `src/app/login/__tests__/page.test.tsx`) to assert the two `<a>` hrefs and the
ES/EN labels.

**Alternatives considered**:
- *Full render with a React testing library*: none is installed for pages (`vitest`
  `environment: "node"`, no `@testing-library/react` in the page-test files). Rejected.
- *Only `readFileSync` assertions*: cheapest and honors the task's stated convention, but it
  can't assert the rendered `href` values on `<Link>` elements (string assertions on the JSX
  source are weaker than walking the real element tree). A render assertion mirrors the
  login-page tests and adds real behavior coverage for the two CTA targets.

**Rationale**: The repo has *two* established page-test styles; both are legitimate and
already coexist (`/t/[slug]` uses `readFileSync` for token/structure assertions while
`login`/`client/login` render the component and walk the tree). Using both gives the
cheapest robust coverage: source assertions guard against reintroducing the redirect,
hard-coding colors, or the wrong token; the render assertion guards the actual navigation
targets and labels.

## Data Flow

The landing is a pure read path with no data layer, no auth, and no mutation.

```
GET /  (or /?lang=en)
   │
   ▼
src/app/page.tsx  (async Server Component)
   │  await searchParams
   │  getLangFromSearchParams(sp) ?? DEFAULT_LANG   ← src/lib/i18n.ts
   │  t = dictionary[lang]
   ▼
Renders:
   ├─ Hero: hubit-logo-transparent.png + headline/subhead (t.*)
   ├─ <LanguageToggle lang={lang} variant="light" />   ← client island (localStorage / ?lang=)
   ├─ Split LEFT  (wine overlay) → <Link href="/login">{t.landingAgentLabel}</Link>
   └─ Split RIGHT (gold overlay) → <Link href="/client/login">{t.landingTravelerLabel}</Link>
   │
   ▼
HTML → browser. LanguageToggle (client) re-renders on toggle via router.replace(`/?lang=…`).
```

No Server Action, no `redirect`, no `src/lib/data.ts`, no Supabase call. The only
stateful surface is `LanguageToggle`'s existing localStorage/`?lang=` behavior.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/page.tsx` | Modify | Replace `redirect("/dashboard")` with the async `LandingPage` Server Component: full-bleed hero + wine/gold center split + two `<Link>` CTAs + `<LanguageToggle variant="light" />`. |
| `src/lib/i18n.ts` | Modify | Add flat ES/EN landing keys to `dictionary` (headline, subhead, agent label/hint, traveler label/hint). |
| `src/app/__tests__/page.test.tsx` | Create | Vitest: `readFileSync` source assertions + a render assertion for the two CTA hrefs and ES/EN labels + a dictionary parity check. |
| `src/app/globals.css` | **No change** | Wine (`--operator-brand`/`--operator-action`) and gold (`--operator-gold`/`--operator-accent`) tokens already exist in light and `.dark`; no new token or hard-coded color is required. |
| `src/components/` | **No new file** | Split is single-use; mirrors self-contained login pages. (Optional `LandingSplitPanel` extraction is noted but not required.) |
| `public/` | **No change** | No new imagery; distinct sides use token color/gradient over the existing `hubit-login-office.png`. |

## Interfaces / Contracts

### Component signature (`src/app/page.tsx`)

```ts
export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<JSX.Element>  // (return type inferred; mirrors /t/[slug])
```

Behavior contract:
- `const lang = getLangFromSearchParams(await searchParams) ?? DEFAULT_LANG;`
- `const t = dictionary[lang];`
- Renders exactly two navigation CTAs (real `<Link>`s), no third entry point.
- Uses only `--operator-*` tokens for the split colors (wine agent / gold traveler).

### i18n dictionary keys (added to BOTH `es` and `en` in `src/lib/i18n.ts`)

| Key | `es` (default) | `en` |
|-----|----------------|------|
| `landingHeadline` | `"Planifica. Gestiona. Viaja."` | `"Plan. Manage. Travel."` |
| `landingSubhead` | `"La plataforma para agentes y viajeros que planifican, gestionan y viven cada viaje."` | `"The platform for agents and travelers who plan, manage, and live every trip."` |
| `landingAgentLabel` | `"Acceder Agentes"` *(pinned by spec)* | `"Agent Login"` |
| `landingAgentHint` | `"Acceso para agencias de viajes"` | `"For travel agencies"` |
| `landingTravelerLabel` | `"Ingresar Viajeros"` *(pinned by spec)* | `"Traveler Login"` |
| `landingTravelerHint` | `"Acceso para viajeros"` | `"For travelers"` |

Constraint: `landingAgentLabel` and `landingTravelerLabel` MUST be non-ambiguous and
distinct in **both** languages (spec § "Distinct CTA labels per audience"). The ES values
are pinned; the EN values above are proposed defaults (see Open Questions).

### Test-visible markers (data-testid)

| `data-testid` | Purpose |
|---------------|---------|
| `landing-hubit-hero` | Root `<main>` of the landing (analogous to `login-hubit-hero`) |
| `landing-split` | The split container holding both sides |
| `landing-agent-side` | LEFT agent pane (wine) |
| `landing-traveler-side` | RIGHT traveler pane (gold) |
| `landing-agent-cta` | Agent `<Link>` → `/login` |
| `landing-traveler-cta` | Traveler `<Link>` → `/client/login` |

These markers are the stable anchors for both the `readFileSync` source assertions and the
render-tree assertions, and they keep the token-discipline checks grep-able.

### Token discipline contract

- Agent (wine): `--operator-brand` / `--operator-action` / `--operator-action-foreground`.
- Traveler (gold): `--operator-gold` / `--operator-accent` / `--operator-accent-foreground`.
- Forbidden: raw hex literals (`#510034`, `#ffad18`, …) in `page.tsx`; arbitrary blue/gray
  defaults; any new accent token not justified by DESIGN.md (none is needed here).

## Testing Strategy

Strict TDD is ON (`openspec/config.yaml` → `testing.strict_tdd: true`,
`apply.tdd: true`, `test_command: npm run test`). RED tests are written **before** the
implementation. `npm run test` = Vitest, `environment: "node"`,
`include: ["src/**/*.test.{ts,tsx}"]`, `@` alias resolved.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit (source assertions) | No redirect; two correct CTA targets; split markers; wine/gold token usage; no hard-coded hex; i18n wiring | `readFileSync(new URL("../page.tsx", import.meta.url), "utf8")` string assertions (the `/t/[slug]` + `operator-primitives` convention) |
| Unit (render) | Rendered tree has exactly two `<a>` links → `/login` and `/client/login`; default ES labels "Acceder Agentes" / "Ingresar Viajeros"; `?lang=en` yields English labels; unknown lang falls back to ES | Import default export, call `LandingPage({ searchParams: Promise.resolve({ lang }) })`, walk element tree with `findElements`/`textContent` (the `login`/`client/login` convention) |
| Unit (i18n parity) | Every `landing*` key exists in BOTH `es` and `en` | Assert key-set parity on the `dictionary` export (prevents "missing key → raw key" runtime) |
| Integration | N/A — no data layer, auth, or Server Action is touched | — |
| E2E | `/` renders landing, no redirect to `/dashboard`; both CTAs navigate | Manual/verify-only: run `npm run test:e2e` to confirm removing the root redirect breaks nothing (grep found no test asserting `/` → `/dashboard`). Optional additive `e2e/mock/landing.spec.ts` if scope permits. |

### Planned RED tests (concrete)

1. `src/app/__tests__/page.test.tsx` — `readFileSync` assertions:
   - `expect(page).not.toContain('redirect("/dashboard")')`
   - `expect(page).toContain('href="/login"')` and `expect(page).toContain('href="/client/login"')`
   - `expect(page).toContain('data-testid="landing-agent-side"')` and
     `expect(page).toContain('data-testid="landing-traveler-side"')`
   - `expect(page).toContain('var(--operator-brand)')` (agent/wine) and
     `expect(page).toContain('var(--operator-gold)')` **or** `var(--operator-accent)` (traveler/gold)
   - `expect(page).not.toContain('#510034')` / `expect(page).not.toContain('#ffad18')` (no hard-coded hex)
   - `expect(page).toContain('getLangFromSearchParams')` (i18n wired, not hard-coded ES)
2. `src/app/__tests__/page.test.tsx` — render assertions:
   - exactly two `a` links; one `href === "/login"`, one `href === "/client/login"`
   - default (`{}` searchParams): text contains "Acceder Agentes" and "Ingresar Viajeros"
   - `{ lang: "en" }`: text contains "Agent Login" and "Traveler Login"
   - `{ lang: "fr" }`: falls back to the ES labels (no raw key, no English)
3. Dictionary parity: for each `landing*` key, `expect(dictionary.es[key]).toBeDefined()` and
   `expect(dictionary.en[key]).toBeDefined()`.

## Threat Matrix

`N/A` — this is a static UI page change. The design adds no routing/shell/subprocess,
VCS/PR automation, executable-file classification, or process-integration boundary.

Reasoning per boundary:
- *Routing*: removing a static `redirect("/dashboard")` and adding two static
  `<Link href>` literals is not an adversarial routing boundary — there is no
  user-controlled path, no dynamic route resolution, no `git -C`/cwd authority, and no
  command composition. The matrix's "routing" rows concern shell/executable selection, not
  static route replacement.
- *Shell/subprocess/process integration*: none introduced.
- *VCS/PR automation / executable-file classification*: none touched.

No matrix rows are applicable, so no RED tests are derived from it. (Applicable matrix rows
would be design requirements carried unchanged into `tasks.md`; there are none here.)

## Migration / Rollout

No migration, no data-layer state, no middleware change. Rollout is a plain source change:

1. Write RED tests (`src/app/__tests__/page.test.tsx`) — they fail against the current
   `redirect("/dashboard")` page.
2. Implement `src/app/page.tsx` + `src/lib/i18n.ts` additions — tests go green.
3. Verify: `npm run test` (unit), `npm run typecheck` (`npx tsc --noEmit`), `npm run lint`,
   `npm run build`, and `npm run test:e2e` (confirm root-redirect removal is safe).

**Impeccable surface workflow (apply-time):** per the project skill
(`.opencode/skills/impeccable/`, `.impeccable/config.json` → `buildPath: "code"`), the
applier runs `impeccable context` once, loads the `reference/new-work.md` playbook for this
new `/` surface (mode `Persuade`), reads `reference/craft-floor.md` immediately before any
UI edit, and verifies in bounded passes (one batched desktop+mobile screenshot round, one
fix batch, at most one confirmation round, then stop). The landing **extends** the committed
"The Considered Travel Desk" world; the applier must honor DESIGN.md's Don'ts (no hard-coded
colors, no revived operator-login world, no arbitrary blue/gray defaults) and the craft-floor
bans that don't conflict with the committed world (no gradient text, no hard-offset shadows,
no emoji-as-icons, no monospace-as-costume). The incumbent editorial taglines ("People /
Places / Possibilities", "Plan | Manage | Travel | Together") are committed brand voice and
may be reused rather than treated as a banned kicker.

**Rollback**: git-revert the single commit. `src/app/page.tsx` returns to
`redirect("/dashboard")`, the landing test and i18n keys are deleted. No runtime state to
unwind; `/` → `/dashboard` behavior is restored immediately (matches the proposal's rollback
plan).

## Open Questions

- [ ] **English CTA labels** — spec pins only the Spanish ("Acceder Agentes" /
      "Ingresar Viajeros") and requires *distinct, non-ambiguous* English. Proposed defaults
      are "Agent Login" / "Traveler Login". Non-blocking: apply may proceed with these
      defaults and confirm in review.
- [ ] **Headline/subhead copy** — institutional copy is specified behaviorally ("institutional
      context"), not verbatim. Proposed defaults above (`landingHeadline`/`landingSubhead`) are
      placeholders for the surface brief to finalize in the impeccable `new-work` flow.
      Non-blocking.
- [ ] **Optional e2e spec** — whether to add `e2e/mock/landing.spec.ts` as a deliverable, or
      treat `/` coverage as unit-only with `npm run test:e2e` run at verify. Non-blocking;
      default is unit-only + verify-run.

No blocking questions: all spec requirements are satisfiable with the existing token system
and i18n machinery, and the two pinned product decisions (color differentiation now, imagery
later) are already resolved in the proposal.

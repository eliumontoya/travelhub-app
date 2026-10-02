# Proposal: Página inicial (public landing — agent / traveler split)

## Intent

TravelHub (HUBit by TravelHub) has no public front door. The root route `/` is a
5-line `redirect("/dashboard")`, so visitors land directly inside the authenticated
agent workspace with no institutional, informative entry point. This change replaces
that redirect with a public, Persuade-mode landing page that introduces the product and
routes each audience to its own login: **agents** enter through `/login`, **travelers**
through `/client/login`. The two sides must read as visually distinct (different color
treatment and/or background imagery) while staying inside the committed HUBit design
system ("The Considered Travel Desk").

## Scope

### In Scope
- Replace `src/app/page.tsx`'s unconditional `redirect("/dashboard")` with a public
  Server Component landing at `/` in impeccable `Persuade` mode.
- A center split with two CTAs: LEFT "Acceder Agentes" → `/login`; RIGHT "Ingresar
  Viajeros" → `/client/login`.
- Visual differentiation between the two sides using the existing `--operator-*` token
  system (wine vs gold) and/or distinct background imagery, per the design decision below.
- ES/EN bilingual copy added to `src/lib/i18n.ts`, following the public-page
  `LanguageToggle` / `?lang=` pattern used by `/t/[slug]`.
- Vitest coverage for the new route (strict TDD), asserting both CTA targets and the
  split markers, in the repo's source-file assertion style.

### Out of Scope
- Any change to the login pages themselves (`/login`, `/client/login`) — they remain
  the CTA targets only.
- Middleware/auth changes — `/` is already public; `/dashboard/:path*` protection is
  unchanged.
- New photographic assets — none can be generated; if distinct imagery per side is
  required, assets must be supplied (see Decision 1).
- Any marketing content beyond the institutional hero and two CTAs (no pricing, no
  feature grid, no SEO blog).

## Capabilities

> Contract with the specs phase. `public-landing` is a new capability name verified to
> not collide with any existing `openspec/specs/` entry.

### New Capabilities
- `public-landing`: the public, unauthenticated root landing that introduces HUBit and
  routes agents to `/login` and travelers to `/client/login`, with ES/EN copy and a
  visually-distinct split aligned to the `--operator-*` token system.

### Modified Capabilities
- None

## Approach

Public Server Component landing at `/` (Approach 1 from exploration). Replace the root
redirect with a `Persuade`-mode landing that **extends** the committed HUBit world —
institutional branding, the shared hero copy ("People / Places / Possibilities",
"Plan | Manage | Travel | Together", `hubit-logo-transparent.png`), and a center split.

Left side = agent → `/login`; right side = traveler → `/client/login`. Distinguish the
sides with the existing token vocabulary (wine `#510034` for the agent/operator side vs
gold `#ffad18` for the traveler/client side) plus CSS gradient/color overlays over the
shared `hubit-login-office.png`, unless two new background assets are supplied. Reuse
`OperatorButton`/`OperatorSurface` primitives. Add ES/EN strings to `src/lib/i18n.ts`
and wire `LanguageToggle variant="light"` + `getLangFromSearchParams`. Cover with Vitest
using the repo's source-file assertion convention. No middleware or data-layer changes.

## Product Decisions (resolved)

- **Distinct sides**: ship with token color/gradient differentiation (wine `#510034`
  agent side vs gold `#ffad18` traveler side) over the shared `hubit-login-office.png`.
  Two distinct agent/traveler background images are a follow-up upgrade, accepted only
  when the user supplies the assets.
- **Branding**: use "HUBit by TravelHub" — the issue's "Hobbit" is a misspelling.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/page.tsx` | Modified | Replace `redirect("/dashboard")` with the landing Server Component |
| `src/lib/i18n.ts` | Modified | Add ES/EN copy: headline + two CTA labels |
| `src/app/globals.css` | Modified (likely) | Possible token/utility only if a second accent is justified by DESIGN.md |
| `src/components/` | New | Landing-specific component (e.g. `LandingSplitPanel`) or reuse of `OperatorButton`/`OperatorSurface` |
| `src/app/__tests__/page.test.tsx` (or `src/app/__tests__/`) | New | Vitest coverage for both CTA targets and split markers |
| `public/` | Modified (optional) | New agent/traveler background assets only if supplied |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Asset gap: only one background image exists; two distinct images can't be generated | High | Differentiate by token color/gradient over the shared image; accept supplied assets as an optional upgrade |
| Root redirect removal breaks an undocumented e2e/doc dependency | Low | Grep found no direct assertion; run `npm run test:e2e` and `npm run build` in verify |
| Hard-coded colors or a second accent violate DESIGN.md Don'ts | Medium | Use only `--operator-*` tokens; add new tokens only if justified and documented |
| Dark-mode legibility of the two split sides | Medium | Verify `.dark` token overrides keep both sides distinct and legible |
| Bilingual copy hard-coded to Spanish despite the ES/EN dictionary | Medium | Route all copy through `dictionary[lang]`, default ES |
| Strict TDD: new route needs passing Vitest before merge | Low | Write source-file assertion tests alongside the page |

## Rollback Plan

Revert `src/app/page.tsx` to the original redirect, delete the landing component and its
test, and remove the landing-only i18n strings. Git-revert the single commit/PR; no
migration, middleware, or data-layer state is touched, so rollback is a clean source
revert with no runtime state to unwind. The `/` → `/dashboard` behavior is restored
immediately.

## Dependencies

- Two new background images (one agent, one traveler) **only if** the distinct-side
  requirement is honored with imagery rather than color — to be supplied by the user;
  otherwise none (color/gradient differentiation over `hubit-login-office.png`).
- `impeccable` skill (project-scoped, `.opencode/skills/impeccable/`) for the
  Persuade-mode surface; `PRODUCT.md` and `DESIGN.md` already present.

## Success Criteria

- [ ] `/` renders a public landing (no redirect) with institutional HUBit branding.
- [ ] A center split shows two CTAs: LEFT "Acceder Agentes" → `/login`, RIGHT "Ingresar
      Viajeros" → `/client/login`.
- [ ] The two sides are visually distinct via the `--operator-*` token system (and/or
      supplied imagery), and remain legible/distinct in dark mode.
- [ ] ES/EN copy is served through `src/lib/i18n.ts` + `?lang=`/`LanguageToggle`.
- [ ] `npm run test` passes with new Vitest coverage asserting both CTA targets.
- [ ] `npm run build` and `npm run test:e2e` pass (root redirect removal verified safe).
- [ ] No hard-coded colors outside the token system (DESIGN.md Don'ts honored).

# Exploration: Página inicial (landing pública con split agente / viajero)

Issue #358 "Pagina inicial" (enhancement, approved).

## Current State

### Root route `/`
`src/app/page.tsx` is a 5-line Server Component that unconditionally redirects:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

There is NO marketing/landing page anywhere in the app. `src/middleware.ts` only
protects `/dashboard/:path*` (`matcher: ["/dashboard/:path*"]`), so `/` is fully
public today — a public landing page can live there without touching auth.

### Login routes (exact URLs for the two CTAs)
- **Agente** → `/login` (`src/app/login/page.tsx`): email + contraseña, Server Action
  `signIn` (`src/app/login/actions.ts`), redirect target `/dashboard`, tagline
  `"Tu agencia. Más lejos."`
- **Viajero** → `/client/login` (`src/app/client/login/page.tsx`): email + PIN (4–6
  dígitos), Server Action `clientSignIn` (`src/app/client/login/actions.ts`), redirect
  target `/client`, tagline `"Tu viaje. Más cerca."`

Both logins already share a near-identical hero (`bg-[#1f1017]`, wine gradient overlay
over `/hubit-login-office.png`, "People / Places / Possibilities", "Plan | Manage |
Travel | Together", `hubit-logo-transparent.png`).

### Look & feel / design system
- **Tailwind v4** (`@tailwindcss/postcss ^4`); `src/app/globals.css` uses
  `@import "tailwindcss"`, `@custom-variant dark`, and `@theme inline`.
- **Design tokens** live in `src/app/globals.css` as `--operator-*` custom properties
  (light + `.dark`). Key values: canvas `#fdf7f3`, surface `#ffffff`, brand
  `#510034` (dark `#b53073`), brand-strong `#350022` (dark `#942257`), coral
  `#ff5848`, gold/accent `#ffad18`, ink `#40142c`, muted `#76596a`, border `#eadde3`.
- **Fonts**: Geist + Geist Mono via `next/font/google` in `src/app/layout.tsx`
  (`--font-geist-sans`, `--font-geist-mono`).
- **Shared primitives**: `src/components/ui/OperatorButton.tsx` (`primary | gold |
  secondary`) and `src/components/ui/OperatorSurface.tsx` (`card | panel | subtle`).
  `src/components/ui/README.md` mandates using the `--operator-*` tokens and forbids
  raw corporate colors.
- **Authoritative design system**: `DESIGN.md` — creative north star "The Considered
  Travel Desk"; warm editorial character, "Travel Wine" primary + "Golden Route Accent"
  secondary; explicit Don'ts: "Do not revive the obsolete operator-login visual world",
  "Do not replace the shared token vocabulary with arbitrary blue/gray defaults",
  "Do not use hard-coded colors where an existing semantic token expresses the intent."
- **Branding**: metadata title is `HUBit by TravelHub` (`layout.tsx`). PRODUCT.md
  states "The product is named **HUBit by TravelHub**." All logos are `hubit-*`.

> Note on the issue text: "la app Hobbit" is almost certainly a misspelling of
> **HUBit** — every artifact (metadata, PRODUCT.md, `hubit-*` filenames) says "HUBit by
> TravelHub". There is no "Hobbit" brand in the repo.

### Assets (`public/`)
| File | Role |
|------|------|
| `hubit-login-office.png` (1672×941, 2.08 MB) | The ONLY photographic background; shared by both login pages |
| `hubit-logo-transparent.png` (728×282 RGBA) | Primary transparent logo |
| `hubit-logo-sidebar.png` (728×282 RGBA) | Sidebar logo (dashboard) |
| `logo-transparent.png` (728×282 RGBA) | Duplicate of `hubit-logo-transparent.png` (identical byte size) |
| `logo.jpeg` (728×282) | JPEG logo |
| `favicon.jpeg` (2048×2048) | Favicon |

**Asset gap:** there is exactly ONE background image (`hubit-login-office.png`). No
distinct "agent" vs "traveler" background imagery exists. A split landing that needs
two *different* background images requires new assets, or a CSS-color/gradient-driven
differentiation over the shared imagery (see Approaches).

### `impeccable` contract
- Project-scoped skill: `.opencode/skills/impeccable/SKILL.md` (v4.3.1).
- Config: `.impeccable/config.json` = `{ "buildPath": "code" }` → live iteration
  targets the running Next dev server, not a static dist.
- `src/app/layout.tsx` already injects the `impeccable-live` script
  (`http://localhost:8400/live.js`) between `impeccable-live-start/end` markers.
- Required workflow: run `impeccable context` once per session; load the request
  playbook (new surface → `reference/new-work.md`); read `reference/craft-floor.md`
  immediately before ANY UI edit; verify in bounded passes (batched desktop+mobile
  screenshot round, one fix batch, at most one confirmation round, then stop).
- **Mode for this surface: `Persuade`** (landing → the visitor decides and acts).
- `PRODUCT.md` and `DESIGN.md` already exist and capture the incumbent HUBit visual
  world → this landing should **extend** the committed world, not replace it. A new
  surface brief for `/` will be created under impeccable's new-work flow.

### Specs / capabilities (openspec)
No "landing" or "public marketing" capability exists in `openspec/specs/`. Relevant
existing capabilities: `public-trip-sharing`, `client-home`, `client-auth`,
`auth-admin`, `account-roles`, `dashboard-workspace`, `dashboard-workspace` (branding).
This change needs a **new** capability (e.g. `public-landing` / `landing-page`).

Active (non-archived) changes: `traveler-logo-left-es-en` (pure layout on `/t/[slug]`,
unrelated but demonstrates the ES/EN pattern), `eve-whatsapp-agent-migration`,
`mcp-server-agent-actions`, `microspec-small-ux-fixes-2026-09-20`.

### i18n / language
- `src/lib/i18n.ts`: `Lang = "es" | "en"`, `DEFAULT_LANG = "es"`, query param `lang`,
  localStorage key `travelhub-lang`, a `dictionary` for ES/EN, `getLangFromSearchParams`,
  `localeFor`.
- `src/components/LanguageToggle.tsx`: ES/EN toggle with `variant: "dark" | "light"`.
- Public `/t/[slug]` uses `getLangFromSearchParams` + `dictionary[lang]` +
  `<LanguageToggle variant="light" />`. A public landing should follow the same
  pattern for bilingual copy. `<html lang="es">` is fixed in `layout.tsx`.

### Test conventions (strict TDD ON)
`npm run test` = Vitest (`environment: "node"`, include `src/**/*.test.{ts,tsx}`).
Login pages have `__tests__/page.test.tsx` that assert on the source file via
`readFileSync(new URL("../page.tsx", import.meta.url), "utf8")` (string/structural
assertions). A new landing page will need analogous tests asserting the two links
(`/login` and `/client/login`) and the visual split markers.

## Affected Areas

- `src/app/page.tsx` — replace the `redirect("/dashboard")` with the landing page.
- `src/app/globals.css` — possible new tokens/utility if the split needs a second
  accent color beyond the current wine/gold palette (only if justified by DESIGN.md).
- `src/lib/i18n.ts` — add ES/EN strings for the landing copy (headline, two CTAs).
- `src/components/` (optional) — a landing-specific component (e.g. `LandingSplitPanel`)
  or reuse of `OperatorButton`/`OperatorSurface`.
- `public/` — (optional) new agent-vs-traveler background assets if the brief's
  "different background image per side" is honored with imagery rather than color.
- `src/app/__tests__/` or `src/app/__tests__/page.test.tsx` — new Vitest coverage.

## Approaches

1. **Public Server Component landing at `/` with two visually-distinct split CTAs.**
   Replace the root redirect with a `Persuade`-mode landing: institutional HUBit
   branding, center split — LEFT = "Acceder Agentes" → `/login`, RIGHT = "Ingresar
   Viajeros" → `/client/login`. Distinguish the two sides via color (wine vs gold,
   per the token system) and either (a) two new background images or (b) gradient/
   color overlays over `hubit-login-office.png`. Bilingual via the i18n dictionary.
   - Pros: matches the issue exactly ("página inicial", institutional, center split,
     two distinct sides); `/` is already public (no middleware change); reuses the
     committed HUBit world; smallest blast radius (single route).
   - Cons: needs a distinct visual treatment for each side (asset gap); requires
     impeccable new-surface workflow; strict-TDD coverage for a new route.
   - Effort: **Medium**.

2. **Keep `/` redirecting; add a separate `/inicio` (or `/landing`) marketing route.**
   - Pros: leaves the current redirect untouched.
   - Cons: contradicts the issue ("página inicial" = root); a second URL is a weaker
     institutional entry point; `/` would still bounce authenticated users to the
     dashboard with no public front door.
   - Effort: Low–Medium (but wrong per requirements).

3. **Client component with heavy `impeccable live` iteration.**
   Build the landing as a `"use client"` surface for fast in-browser variant iteration,
   then freeze the chosen variant.
   - Pros: fastest visual iteration path.
   - Cons: a mostly-static landing needs no client interactivity; Server Component is
     the repo default and keeps the page lighter/faster (better for a marketing page).
   - Effort: Medium.

## Recommendation

**Approach 1.** Replace `src/app/page.tsx`'s redirect with a public Server Component
landing at `/`, in impeccable `Persuade` mode, extending (not replacing) the committed
HUBit world. Left side (agent) → `/login`, right side (traveler) → `/client/login`,
with the two sides differentiated by the existing token system (wine vs gold) and,
if imagery is required, two new background assets — otherwise color/gradient
differentiation over the single existing `hubit-login-office.png`. Add ES/EN copy to
`src/lib/i18n.ts`, follow the `LanguageToggle`/`?lang=` public-page pattern, and cover
it with Vitest (strict TDD). No middleware or data-layer changes required.

## Risks

- **Asset gap**: only `hubit-login-office.png` exists; two distinct background images
  must be added or the differentiation done with CSS color/gradients. New photographic
  assets cannot be generated — they must be supplied or sourced.
- **Root redirect removal**: verify no e2e/unit test or doc depends on `/` → `/dashboard`
  (grep found no direct test asserting it, but Playwright suites exist under
  `test:e2e`).
- **Design-token discipline**: the two sides must stay within `--operator-*` tokens per
  DESIGN.md's explicit Don'ts; introducing a hard-coded second accent would violate the
  committed system.
- **Dark mode**: `.dark` token overrides must keep both split sides legible and distinct.
- **i18n**: the landing must respect the existing ES/EN dictionary + `?lang=` mechanism,
  not hard-code Spanish-only copy (despite the issue being written in Spanish).
- **Strict TDD**: new route needs passing Vitest coverage before merge; the repo's
  page-test style is source-file assertion, not full render.

## Ready for Proposal

**Yes.** The change is well-scoped and unblocks on exactly two decisions for the
orchestrator to carry into propose/spec/design:
1. Whether the "different background image" per side is honored with **two new assets**
   (to be supplied) or with **CSS color/gradient differentiation** over the shared
   office image.
2. Confirm the new capability name (suggested: `public-landing`) and that "Hobbit" =
   "HUBit by TravelHub" branding.

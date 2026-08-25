# Proposal: traveler-logo-left-es-en

## Intent

On the public traveler page `/t/[slug]`, reclaim vertical space in the header by:
1. Placing the agency logo on the **LEFT** side of the content block that holds the trip
   summary + contact data (title, dates, traveler count, email, phone) — inside the existing
   cover-image hero, keeping the text-over-image look.
2. Moving the **ES/EN `LanguageToggle`** out of the hero and **BELOW** the hero box, onto the
   light `bg-gray-50` page surface.

This is a **pure layout change**. No data model, migration, settings, or new fields are in scope.

## What Changes

- **`src/app/t/[slug]/page.tsx`** (hero, lines ~84–132):
  - Remove the current top row `flex items-start justify-between` that placed the logo
    (left) + `LanguageToggle` (right) **above** the title/dates/contact stack.
  - Restructure the hero inner block into a horizontal arrangement: the logo block on the **left**
    (`flex items-center gap-3` with `logoUrl` img + `agencyName` span, kept `text-white` over the
    cover image) and the title/dates/contact stack on the **right**.
    - Responsive: `flex flex-col gap-3 sm:flex-row sm:items-center` so it stacks gracefully on
      narrow screens and goes side-by-side from `sm:` up.
  - Move `<LanguageToggle lang={lang} />` out of the hero wrapper and render it **below** the hero
    (outside the `print:hidden` hero `div`), in a wrapper such as
    `<div className="mx-auto mt-4 max-w-2xl px-4 print:hidden">…</div>`, above the main
    itinerary layout. Pass `variant="light"` so it is visible on the light surface.
- **`src/components/LanguageToggle.tsx`**:
  - Add an optional `variant?: "dark" | "light"` prop (default `"dark"`) so existing/other usages
    are unaffected.
  - Add a **light** variant used when placed below the hero: neutral border
    (`border-gray-300 dark:border-gray-600`), dark text (`text-gray-700 dark:text-gray-200`),
    `hover:bg-gray-100 dark:hover:bg-gray-800`; keep the active-state emphasis
    (`bg-gray-900 text-white` when selected) for clarity. The current `dark` variant styles remain
    exactly as today.

## What Stays The Same

- The cover-image hero look (`h-56`/`sm:h-72`, gradient overlay, `text-white`, `print:hidden`).
- `SiteSettings.agencyName?` / `logoUrl?`, the data layer, mock data, settings form, and migration
  `0033_site_settings_branding.sql` — **untouched** (logo fields already exist and render).
- `LanguageToggle` behavior (localStorage persistence, `?lang=` query param sync, `router.replace`)
  — only its visual classes change behind the `variant` prop.
- The print header block (`hidden print:block`, lines ~134–139) — untouched.
- `ThemeToggle`, `AddTripToCalendarButton`, `PrintButton`, sidebar, and all itinerary content below.

## Scope Boundaries

- **IN**: hero layout restructuring in `page.tsx`; `LanguageToggle` `variant` prop + light styles;
  placement of the toggle below the hero.
- **OUT** (explicitly excluded):
  - Any `SiteSettings` schema, migration, data-layer, or settings-form changes.
  - Any new visible "card" border around the logo+content (see assumption A1).
  - Behavior changes to `LanguageToggle` switching logic.
  - Changes to other pages or components (e.g. `/c/[slug]`, dashboard).

## Assumptions (adjustable at approval)

- **A1 — "cuadro" meaning**: "cuadro" refers to the **existing hero content block** (logo left +
  title/dates/contact right), **not** a new visible card. We keep the text-over-cover-image look and
  do **not** add a bordered card. If the user wants a visible card boundary instead, this becomes
  Approach 2 (grid-based header card) and scope grows — flag at approval.
- **A2 — Toggle stays screen-only**: the moved `LanguageToggle` is `print:hidden`, matching current
  behavior (it lived inside the `print:hidden` hero). Language printed is driven by the `?lang=`
  URL param, not the toggle control.
- **A3 — Light variant only below hero**: only the below-hero instance uses `variant="light"`; the
  component default (`dark`) preserves any future in-hero usage.

## Risks

- **R1 — Toggle invisibility (HIGH if unaddressed)**: `LanguageToggle` is currently white-on-dark;
  placed on `bg-gray-50` it would be invisible. Mitigated by adding the `light` variant (in scope).
- **R2 — Print regression**: moving the toggle below the hero could start rendering it in print.
  Mitigated by wrapping it in `print:hidden`.
- **R3 — Responsive regression**: a side-by-side logo/content layout can crowd small screens.
  Mitigated by `flex-col` → `sm:flex-row`.
- **R4 — "cuadro" ambiguity**: if a visible card was intended, the layout differs. Mitigated by A1
  and review at approval.

## Rollback Plan

Pure layout/style change, no data or migration impact. If regressions appear:

1. Revert the two touched files to their pre-change state:
   `git checkout -- src/app/t/\[slug\]/page.tsx src/components/LanguageToggle.tsx`
2. Verify `npm run build` and `npm run test` (and a quick manual check of `/t/[slug]` header).
3. Because this is additive on a branch, an alternative is to close/abandon the change PR and keep
   `main` untouched — no cleanup of persisted state required.

No feature flag is needed; the change is localized and reversible via file revert.

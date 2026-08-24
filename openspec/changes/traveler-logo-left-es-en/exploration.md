## Exploration: traveler-logo-left-es-en

### Current State

The public traveler page `src/app/t/[slug]/page.tsx` renders a full-width cover hero
(`h-56` mobile, `h-72` desktop) with the trip cover image as background. Inside the hero, a
centered `max-w-2xl` column (`text-white`) contains, top to bottom:

1. A top row (`flex items-start justify-between gap-4`): the agency logo
   (`contact.logoUrl`) + agency name (`contact.agencyName`) on the LEFT, and the
   `LanguageToggle` (ES/EN) on the RIGHT.
2. Trip title (`h1`).
3. Dates and traveler count.
4. Contact email and phone from `getSiteSettings()`.

The logo and agency fields already exist and render correctly:

- `SiteSettings` (`src/types/index.ts`) has `agencyName?: string` and `logoUrl?: string`.
- The data layer (`src/lib/data.ts`), mock data (`src/lib/mock-data.ts`), and settings form
  (`src/app/dashboard/settings/SettingsForm.tsx`) all read/write these fields.
- Migration `0033_site_settings_branding.sql` added the `agency_name`/`logo_url` columns and
  the public `site-assets` storage bucket (merged via PR #143, closes #138).

`LanguageToggle` (`src/components/LanguageToggle.tsx`) is a client component styled for the
dark hero background (white text, `border-white/40`, `hover:bg-white/10`).

The hero currently stacks the logo+toggle row ABOVE the title/dates/contact block, which
consumes vertical space at the top of the page.

### Requested change

On `/t/[slug]`: place the logo on the LEFT side of the box that holds the trip summary +
contact data, and move the ES/EN toggle BELOW that box. Goal: reclaim vertical space in the
header. This is a pure layout change — no data-model, migration, or settings work is required.

### Affected Areas

- `src/app/t/[slug]/page.tsx` — restructure the hero: logo-left + content-right, toggle below.
- `src/components/LanguageToggle.tsx` — may need a light-background variant once it moves below the dark hero.
- No changes needed to `src/types/index.ts`, `src/lib/data.ts`, `src/lib/mock-data.ts`,
  `SettingsForm.tsx`, or migrations (logo fields already exist).

### Approaches

1. **Horizontal flex row (recommended)**
   - Restructure the hero content area: `flex items-center gap-4` with the logo (fixed width)
     on the left and the title/dates/contact stacked on the right. Move `LanguageToggle` out of
     the hero to just below it, above the main itinerary layout.
   - Pros: minimal surface, matches the request exactly, no data changes.
   - Cons: `LanguageToggle` needs a light variant; left/right must stack on narrow screens.
   - Effort: Low.

2. **Grid-based header card**
   - Wrap logo + summary in a visible card (`grid grid-cols-[auto_1fr]`) and place the toggle
     below the card.
   - Pros: clearer "box" boundary matching the word "cuadro".
   - Cons: more markup; risk of visual regression vs. the current text-over-image look.
   - Effort: Low–Medium.

### Recommendation

Proceed with **Approach 1**. Pure layout change on `page.tsx` (+ optional light styling on
`LanguageToggle`). No data/migration work needed.

### Risks

- **LanguageToggle styling**: currently white-on-dark; needs a neutral variant below the hero.
- **Print view**: the hero is `print:hidden`; moving the toggle must not affect print output.
- **Responsive behavior**: a left/right hero layout must stack gracefully on narrow screens.
- **"cuadro" ambiguity**: the request says "cuadro" (box); confirm whether a visible card
  boundary is desired or just a side-by-side arrangement.

### Ready for Proposal

Yes.

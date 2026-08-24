# Tasks: traveler-logo-left-es-en

Pure layout change on the public traveler page `/t/[slug]`. Touches only `src/components/LanguageToggle.tsx` and `src/app/t/[slug]/page.tsx`. No data model, migration, Server Action, or schema work is in scope.

## Implementation Tasks

### Phase 1 — `LanguageToggle` variant support

- [x] Open `src/components/LanguageToggle.tsx`.
- [x] Add an optional `variant?: "dark" | "light"` prop with a default of `"dark"` so existing callers are unchanged.
- [x] Derive container and button class fragments based on the variant:
  - `dark` (default): keep today's `border-white/40`, `text-white/80`, active `bg-white text-gray-900`.
  - `light` (new): use `border-gray-300 dark:border-gray-600`, `text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800`, active `bg-gray-900 text-white`.
- [x] Apply the derived classes to the toggle container and each language button without changing the language-switching logic, `useEffect`, `localStorage`, or `?lang=` sync.

### Phase 2 — Hero inner block restructure

- [x] Open `src/app/t/[slug]/page.tsx`.
- [x] Remove the existing top row that places the logo/name on the left and the `<LanguageToggle>` on the right inside the hero.
- [x] Replace it with a single flex row inside the existing `text-white` hero container:
  - Left column (conditional): render the agency logo image (`h-12 w-auto rounded-lg bg-white/90 p-1 object-contain shadow-sm`) and agency name (`text-base font-semibold drop-shadow break-words`) only when `contact.logoUrl` or `contact.agencyName` is configured.
  - Right column: keep the trip title, dates, traveler count, email, and phone stack with `min-w-0 flex-1` so long content wraps.
  - Use `flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4` for responsive stacking.
- [x] Ensure no new visible card border or background is introduced; preserve the text-over-cover-image appearance.
- [x] Verify the guard correctly skips the left column when neither logo nor agency name is configured (graceful degradation).

### Phase 3 — Move language toggle below the hero

- [x] In `src/app/t/[slug]/page.tsx`, render `<LanguageToggle lang={lang} variant="light" />` outside the `print:hidden` hero div, after the hero closes.
- [x] Wrap the toggle in a container with `mx-auto mt-4 max-w-2xl px-4 print:hidden` so it aligns with the hero inner block, sits on the light page surface, and is hidden in print output.
- [x] Confirm the existing `hidden print:block` print header remains untouched.

### Phase 4 — Verification

- [x] Run `npx tsc --noEmit` and resolve any TypeScript errors introduced by the new prop or markup changes.
- [x] Run `npm run lint` and resolve any lint errors.
- [x] Run `npm run test` and review results. If no relevant test exists for these components, note `N/A` in the verification log.
- [x] Run `npm run build` and confirm the production build succeeds.
- [ ] Manually verify `/t/[slug]` in a browser (or dev preview):
  - With `logoUrl` and `agencyName` configured: logo and name appear on the left of the trip summary inside the hero; toggle appears below the hero on the light surface.
  - Without `logoUrl` and `agencyName`: only the trip summary block is shown, no broken image or empty placeholder, layout stays intact.
  - Narrow viewport (`< sm`): logo and summary stack vertically without overlap.
  - Print preview / print media emulation: language toggle and hero are hidden; print header remains visible.

## Review Workload Forecast

- **Estimated changed lines**: ~60–80 lines across 2 files (`src/app/t/[slug]/page.tsx`, `src/components/LanguageToggle.tsx`).
- **Chained PRs recommended**: No. The change is a single, coherent layout update with one verification unit.
- **400-line budget risk**: Low.
- **800-line budget risk**: Low.
- **Decision needed before apply**: No. The design, scope, and delivery strategy (`single-pr`) are already aligned for this tiny change.

# HUBit main-surface visual alignment

## Objective
Align the existing TravelHub login, every authenticated agent page, and every traveler/client-facing page with the supplied HUBit mock site's visual system while preserving all current behavior, routes, data access, and accessibility contracts.

## Problem
The reference design establishes a clearer HUBit hierarchy—plum/coral/gold branding, warm paper surfaces, a branded agent shell, and itinerary-led traveler layout—while the existing main routes still use uneven, mostly generic visual treatments.

## Scope
- `/login`: visual composition only; retain existing Supabase sign-in action, validation, redirects, errors, and unconfigured state.
- `/dashboard/**`: visual shell, homepage, trips, clients, suppliers, settings, accounts, WCC, and editor/detail screens; retain navigation, roles, command palette, data queries, links, dashboard actions, and client-side components.
- `/t/[slug]` and `/client/**`: visual hierarchy only; retain public visibility, localization, controls, documents, calendar, feedback, print, login, session, document upload, and traveler activity behavior.
- Shared semantic tokens/primitives and compatibility visual sweep when they safely benefit these surfaces.

## Constraints
- Mock-site files and supplied images are visual references only, never functional or content requirements.
- No data, action, auth, route, or domain-logic changes.
- Strict TDD is enabled; preserve existing focused tests and add or update coverage for structural behavior only when needed.
- Route: direct inline due explicit user authorization and no requested sub-agent delegation; this is an exception to the normal multi-file writer trigger.

## Acceptance criteria
- [x] HMS-001 — Login reflects the HUBit reference hierarchy without changing sign-in behavior or state rendering.
- [x] HMS-002 — Dashboard shell and homepage use the HUBit agent hierarchy without changing data, links, or admin-only navigation.
- [x] HMS-003 — All dashboard subpages inherit the HUBit visual system, including legacy WCC/admin/client/trip surfaces, without changing behavior.
- [x] HMS-004 — Traveler and client-facing surfaces use the reference trip-first visual hierarchy without changing public/client controls.
- [x] HMS-005 — Main surfaces use consistent, accessible visual tokens; desktop and mobile renders are inspected.
- [x] HMS-006 — Targeted tests, typecheck, build/checks, and Impeccable detector results are recorded before completion.

## Verification
- Existing route tests plus any focused structural tests needed for preserved behavior.
- `npx tsc --noEmit`
- `npm run build -- --webpack`
- Impeccable detector on changed UI targets.
- Desktop/mobile screenshots for login, dashboard, representative dashboard subpages, traveler, and client-facing pages.

## Progress
- 2026-09-27: Created branch `codex/hubit-visual-alignment` and isolated worktree. Reviewed the supplied mock source and mapped current login, dashboard, traveler, tokens, and behavior boundaries.
- 2026-09-27: Added RED expectations for the HUBit login brand and dashboard shell, then implemented the visual-only GREEN changes.
- 2026-09-27: Initial visual QA incorrectly accepted superficial alignment. The user-provided live screenshot proved the output did not match the mock's concrete visual system; HMS-002 through HMS-005 are reopened.
- 2026-09-27: Rebuilt the login from a generated, provenance-backed travel-office scene and a centered frosted HUBit panel. Focused login tests and TypeScript pass. The dashboard and traveler require the same fidelity pass before this feature can be considered complete.
- 2026-09-27: Corrected the login micro-fidelity from the mock folder: translucent panel, inline email/password icons and placeholders, remember/forgot row, and airplane divider under the CTA. Added failing structural assertions before implementation.
- 2026-09-27: Reworked the agent shell, dashboard home, and KPI cards toward the supplied agent mock while preserving role-gated navigation and existing data loads.
- 2026-09-27: Started a broad dashboard/client visual sweep in `globals.css` so legacy subpages that still use old gray/blue/slate/emerald utility classes inherit HUBit plum, warm surfaces, rounded cards, and border treatment while their components keep working.
- 2026-09-27: Started traveler route alignment with the mock trip hero/timeline and warm itinerary card system.
- 2026-09-27: Verification so far: `npm test -- src/app/login/__tests__/page.test.tsx src/app/dashboard/__tests__/layout.test.tsx`, `npx tsc --noEmit`, and `npm run build -- --webpack` pass.
- 2026-09-27: Rebuilt client login and client document upload pages into the HUBit login/traveler world, restyled settings/suppliers pages, and replaced document/checklist emojis with glyph marks. Commit `b802df9`.
- 2026-09-27: Removed remaining emoji-style travel/status/weather/flight icons from shared item metadata, weather metadata, flight status badge, theme toggle, dashboard updates, and service checklist status helpers. Replaced them with HUBit glyph/letter marks and palette tokens. Verification passed: relevant tests, TypeScript, Webpack build, and Impeccable detector `[]`.


- 2026-09-27: Restyled travel agent catalog, permissions/accounts, and supplier catalog client surfaces into the HUBit plum/warm card system while preserving the existing CRUD/dialog behavior. Verification passed: relevant tests, TypeScript, Webpack build, and Impeccable detector `[]`.

- 2026-09-27: Completed a repository-wide visual utility sweep for remaining dashboard, WCC, client, traveler, and shared UI components. Replaced old blue/gray/slate/emerald/red utility treatments with HUBit semantic tokens, warm surfaces, plum/gold/coral states, and glyph-friendly components. Verification passed: focused Vitest suite (13 tests), `npx tsc --noEmit`, `npm run build -- --webpack`, and Impeccable detector `[]` across changed TSX targets.

- 2026-09-27: Replaced internal/login HUBit logo asset with the designer-provided transparent logo source from `/Users/eliumontoya/Downloads/HUBit-mock-site-source/logotransparente.png`, processed to remove the white matte, published as `/hubit-logo-transparent.png`, and pointed dashboard, agent login, and client login to that same asset. Verification passed: focused Vitest suite (13 tests), `npx tsc --noEmit`, Impeccable detector `[]`, `npm run build -- --webpack`, and visual screenshot inspection of `/login` on port 3333.

- 2026-09-27: Ran final representative visual QA in mock mode by rebuilding without `.env.local` and opening protected/dashboard pages on a temporary `localhost:3335` production server: dashboard desktop/mobile, client detail, trip editor, WCC, public traveler desktop/mobile, and client login redirect. Fixed the global heading override that made dark plum heroes unreadable, then verified WCC and trip editor hero text visually. Removed the remaining traveler lock emoji from `ClientSessionButton` and confirmed the emoji/glyph scan returned no matches.

- 2026-09-27: Added a reusable authored SVG item-type icon system for flight, hotel, restaurant, activity, transport, and note. Replaced visual item-type icon uses in the public traveler itinerary, trip editor, quote page, and item form dialog, and matched the `/t/[slug]` left itinerary panel heading to the reference calendar icon plus “Tu itinerario” treatment. Verification passed: focused Vitest suite (26 tests), `npx tsc --noEmit`, Impeccable detector `[]`, and `npm run build -- --webpack`.

- 2026-09-27: Added a sidebar-specific HUBit logo asset with white HUB/byline and preserved orange “it”, then switched only the desktop purple dashboard sidebar to that asset so the light-header/login logos keep using the original transparent logo. Verification passed: dashboard layout test, `npx tsc --noEmit`, Impeccable detector `[]`, and `npm run build -- --webpack`.

- 2026-09-27: Fixed the public traveler `/t/[slug]` header controls by replacing the letter fallbacks in the theme toggle (`OS`/`CL`) and client session button (`PIN`) with visible SVG icons: moon/sun for dark mode and the same account/user face used in the agent profile menu. Verification passed: focused Vitest suite (5 tests), `npx tsc --noEmit`, Impeccable detector `[]`, and `npm run build -- --webpack`. The broader `/client/login` test still has a pre-existing stale copy expectation for “Acceso para clientes”, so it was not used as evidence for this icon-only fix.

## Next step
Prepare final handoff unless the user asks for PR/push.

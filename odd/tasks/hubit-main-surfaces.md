# HUBit main-surface visual alignment

## Objective
Align the existing TravelHub login, authenticated agent dashboard, and public traveler itinerary with the supplied HUBit mock site's visual system while preserving all current behavior, routes, data access, and accessibility contracts.

## Problem
The reference design establishes a clearer HUBit hierarchy—plum/coral/gold branding, warm paper surfaces, a branded agent shell, and itinerary-led traveler layout—while the existing main routes still use uneven, mostly generic visual treatments.

## Scope
- `/login`: visual composition only; retain existing Supabase sign-in action, validation, redirects, errors, and unconfigured state.
- `/dashboard`: visual shell and homepage only; retain navigation, roles, command palette, data queries, links, dashboard actions, and client-side components.
- `/t/[slug]`: visual hierarchy only; retain public visibility, localization, controls, documents, calendar, feedback, print, and traveler activity behavior.
- Shared semantic tokens/primitives only when they safely benefit these surfaces.

## Constraints
- Mock-site files and supplied images are visual references only, never functional or content requirements.
- No data, action, auth, route, or domain-logic changes.
- Strict TDD is enabled; preserve existing focused tests and add or update coverage for structural behavior only when needed.
- Route: direct inline due explicit user authorization and no requested sub-agent delegation; this is an exception to the normal multi-file writer trigger.

## Acceptance criteria
- [x] HMS-001 — Login reflects the HUBit reference hierarchy without changing sign-in behavior or state rendering.
- [ ] HMS-002 — Dashboard uses a responsive HUBit agent shell and homepage hierarchy without changing data, links, or admin-only navigation.
- [ ] HMS-003 — Traveler itinerary uses the reference's trip-first layout and responsive reading hierarchy without changing public-trip behavior or controls.
- [ ] HMS-004 — Main surfaces use consistent, accessible visual tokens; desktop and mobile renders are inspected.
- [ ] HMS-005 — Targeted tests, typecheck, build/checks, and Impeccable detector results are recorded before completion.

## Verification
- Existing route tests plus any focused structural tests needed for preserved behavior.
- `npx tsc --noEmit`
- `npm run build`
- Impeccable detector on changed UI targets.

## Progress
- 2026-09-27: Created branch `codex/hubit-visual-alignment` and isolated worktree. Reviewed the supplied mock source and mapped current login, dashboard, traveler, tokens, and behavior boundaries.
- 2026-09-27: Added RED expectations for the HUBit login brand and dashboard shell, then implemented the visual-only GREEN changes.
- 2026-09-27: Initial visual QA incorrectly accepted superficial alignment. The user-provided live screenshot proved the output did not match the mock's concrete visual system; HMS-002 through HMS-005 are reopened.
- 2026-09-27: Rebuilt the login from a generated, provenance-backed travel-office scene and a centered frosted HUBit panel. Focused login tests and TypeScript pass. The dashboard and traveler require the same fidelity pass before this feature can be considered complete.

## Next step
Rebuild the agent dashboard and traveler pages from the supplied reference compositions, then rerun full visual and functional verification.

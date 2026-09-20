# Proposal: Small UX Fixes for Traveler and Agent Surfaces

**Change slug:** `microspec-small-ux-fixes-2026-09-20`
**Status:** registration only
**Mode:** OpenSpec micro-spec, outside SDD

## Intent

Register four small TravelHub fixes/improvements before implementation:

1. Add a link from the client document portal at `/client/trips/{id}/documents` back to the linked trip page.
2. On `/t/{slug}`, make the lock icon route already-authenticated travelers to the main client home screen instead of the client login page.
3. On `/t/{slug}`, reduce mobile space used by the traveler add-activity form by replacing always-visible per-day forms with a compact per-day call to action that expands the form only for the selected day.
4. On `/dashboard`, keep the trip status history section compact by showing only the last three entries.

## Scope

### In scope

- Register delta requirements under the relevant existing OpenSpec capabilities.
- Capture mobile-first UX expectations for the traveler add-activity affordance.
- Capture acceptance scenarios for navigation and list truncation behavior.

### Out of scope

- No application code changes.
- No tests, migrations, Server Actions, routes, or component edits.
- No SDD lifecycle, native SDD dispatcher, archive, or merge into baseline specs.
- No commit.

## UX Decision

For the mobile-heavy `/t/{slug}` traveler activity flow, the specification chooses an inline expandable panel triggered by `+ Add activity to this day`, not a modal.

Rationale: the traveler is adding an activity to a specific day, so preserving day context matters more than isolating the form. A modal would reduce vertical page height, but it also interrupts scanning, increases dismissal complexity, and can feel heavy when travelers add multiple day-specific activities. A collapsed CTA with one expanded form at a time keeps the itinerary scannable while keeping the action anchored to the right day.

## Affected Capabilities

- `client-document-upload` — document portal trip navigation link.
- `client-auth` — already-authenticated traveler login avoidance.
- `public-trip-sharing` — lock icon routing and mobile add-activity UX.
- `dashboard-workspace` — compact status history display.

## Risks

- The document portal link must not expose unpublished public trip links to clients who should only access the authenticated client home/trip context.
- The lock icon route must distinguish authenticated client sessions from anonymous public visitors without making public trip viewing require login.
- The add-activity CTA must remain discoverable even when the form is collapsed.
- Limiting visible status history must not remove access to the complete history if a future detailed view is needed.

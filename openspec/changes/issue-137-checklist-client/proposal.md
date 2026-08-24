# Proposal: Checklist visible to the client

## Problem

The trip "checklist" (Spanish: **Checklist de equipaje**, the packing list) is only
rendered in the authenticated agent dashboard (`/dashboard/trips/[id]`). Travelers
who open the public, accountless itinerary (`/t/[slug]`) never see it.

Reported in issue #137 ("checklist visible al cliente"): the client is not seeing
the documentation/checklist. The only checklist feature in the app today is the
packing checklist, so this change makes it visible in the public view.

## Proposed approach

Render the existing packing checklist in the public trip page. Reuse the current
`PackingListManager` component by adding a `readOnly` mode instead of building a
second component.

### Why reuse instead of duplicate

- Keeps a single source of truth for the checklist UI and styling.
- The agent-facing surface (add / toggle / delete via Server Actions) is unchanged.
- The public surface only differs in that it must not accept anonymous writes.

### Public-view behavior (assumptions)

- The checklist is shown only when the trip actually has packing items.
- In the public view the checklist is **read-only from the server's perspective**:
  no add / delete, and toggling a checkbox is tracked **locally in the browser**
  (personal packing tracker) and is NOT persisted. This avoids anonymous users
  mutating the agent's data through a public URL.
- No new opt-out flag is added in this change; showing the checklist to the client
  is consistent with the agent's intent to share the full itinerary. (Can be made
  configurable later, mirroring `showCostsToClient`, if needed.)

## Rollback plan

Remove the `<PackingListManager readOnly />` usage from `src/app/t/[slug]/page.tsx`
and drop the `readOnly`/`title` props if the feature is reverted. No data migration
is involved, so rollback is code-only.

## Out of scope

- A per-trip "show/hide checklist to client" toggle.
- Persisting the client's checked state (would require a client-scoped table).
- Any change to the agent dashboard checklist behavior.

# Proposal: Traveler-Created Trip Activities

## Intent

Let assigned travelers add activities to published itineraries without controlling agency or other travelers' items. Today `/t/{slug}` is read-only.

## Scope

### In Scope
- Add activity creation and owner-only edit/delete controls to `/t/{slug}`; retain anonymous viewing.
- Require PIN session and trip assignment; check publication, day membership, and ownership on each mutation.
- Persist nullable creator attribution (`null` for existing/agent items) in Supabase and mock mode.

### Out of Scope
- Traveler edits to others' items, days, documents, costs, suppliers, or non-activity types.
- Changes to agent published-trip locking or anonymous write policies.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `public-trip-sharing`: Show activity controls to eligible clients; preserve anonymous viewing.
- `trip-itinerary`: Attribute creators and restrict traveler writes without relaxing agent locking.
- `client-auth`: Require PIN session for traveler writes, not viewing.

## Approach

Use dedicated Server Actions/data operations, not agent actions. Derive creator from the session, verify private `trip_clients` assignment, and enforce trip/day/owner predicates at mutation time. Keep anonymous RLS read-only and reuse shared items.

**Assumptions:** Fields: title, optional time, location, notes. Additions are public to trip viewers. Unpublishing/archiving stops writes; additions remain stored. Existing agent draft policy applies.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/t/[slug]/` | Modified | Form, controls, actions |
| `src/lib/data/trips.ts`, `src/lib/mock-data.ts`, `src/types/index.ts` | Modified | Scoped writes, creator mapping |
| `supabase/migrations/` | New | Nullable creator attribution |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unauthorized writes | Medium | Check session, assignment, ownership, day/trip; race-safe predicates |
| Public read regression | Low | Preserve RLS and add regression tests |

## Rollback Plan

Disable traveler actions/UI and revert writes. Retain nullable attribution until affected data is exported.

## Dependencies

- Existing client PIN sessions and private `trip_clients` assignments.

## Success Criteria

- [ ] Assigned signed-in clients can create, edit, and delete only their own activities on published trips.
- [ ] Anonymous, unassigned, expired, cross-client, agent-item, wrong-day, and unpublished mutations fail in Supabase/mock tests.
- [ ] Anonymous trip viewing, agent publish lock, and calendar export still work.

## Deferred Questions

- Confirm first-slice fields and whether agency moderation is needed later.

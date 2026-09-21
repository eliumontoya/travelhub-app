# Proposal: Service Document UI Changes

## Intent

Keep service-document work usable as traveler volume grows. Travelers need a clear path to required uploads; agents need compact progress, focused review, and one-step assignment to every traveler.

## Scope

### In Scope
- Add a document-upload callout below the public packing checklist for an eligible signed-in traveler.
- Replace expanded dashboard checklists with compact per-traveler processed/total and awaiting-review summaries.
- Open one traveler's checklist lazily in a bounded, accessible modal for assignment, ordering, and review.
- Create one requirement atomically across every service/traveler on the trip.
- Permit agent document management on draft or published trips; archived trips remain read-only.

### Out of Scope
- Redesigning the traveler upload portal.
- Changing the per-traveler service model, storage model, or document status vocabulary.
- Adding a separate agent documents route.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- service-checklist-management: Add compact summaries, lazy modal management, atomic all-traveler assignment, and lifecycle rules.
- service-upload-review: Allow agent review after publication and expose uploaded-item review counts.
- public-trip-sharing: Show an ownership-safe upload callout only for the signed-in traveler assigned to the trip.

## Approach

Load traveler summaries and fetch signed document detail only for the selected modal. Count processed uploads as complete and uploaded items as awaiting review. Implement bulk assignment as one validated multi-row operation with mock/Supabase parity. Authorize service-document operations independently from itinerary editing, rejecting archived-trip mutations.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| src/app/t/[slug] | Modified | Session-aware callout below packing checklist |
| src/app/dashboard/trips/[id] | Modified | Summary-first UI, shared modal, actions |
| src/lib/data/services.ts | Modified | Summaries, lazy detail, atomic bulk assignment |
| src/types/index.ts | Modified | Summary projection contracts |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Cross-traveler disclosure | Medium | Resolve callout and detail through the authenticated traveler's service ownership |
| Partial bulk assignment | Medium | Validate targets and insert all rows atomically |
| Modal overflow/accessibility | Low | Bound height, scroll internally, and preserve focus/escape semantics |

## Rollback Plan

Revert UI, actions, data-layer, types, and tests together; no migration or data conversion is planned.

## Dependencies

- Existing client PIN session, service ownership, and document upload route.

## Success Criteria

- [ ] Eligible travelers see the callout; anonymous, unassigned, and zero-requirement viewers do not.
- [ ] Agent rows stay compact regardless of document count, with accurate completion and review counts.
- [ ] Modal workflows remain accessible and functional on published trips.
- [ ] Bulk assignment is all-or-nothing and creates one independent item per traveler.

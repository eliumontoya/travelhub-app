# Exploration: issue #224 unpublished WhatsApp trip guard

## Current State
Dynamic WhatsApp TravelHub tools live in `src/lib/ai/tools/travelhub-client-tools.ts`. Trip-scoped tools verify that the requested trip belongs to the resolved WhatsApp client, then `getTripSummary`, `getTripItineraryStatus`, and `getTripDocumentsStatus` may expose safe trip details. `getClientActiveTrips` can currently return draft trip titles/dates as trip choices.

## Affected Areas
- `src/lib/ai/tools/travelhub-client-tools.ts` — add publication-state gating before trip detail payloads and minimize unpublished active-trip choices.
- `src/lib/ai/__tests__/travelhub-client-tools.test.ts` — focused unit coverage for unpublished summary/itinerary/document guards.
- `openspec/specs/whatsapp-inbound-automation/spec.md` — archive updated behavior for dynamic tools.

## Approaches
1. **Shared publication guard in trip-scoped tool path** — after ownership validation, read the trip status once and return a safe planning-only result for non-`published` trips.
   - Pros: central guard covers summary, itinerary, documents, and future trip-scoped calls that use the same helper.
   - Cons: adds one status read before trip-scoped detail queries.
   - Effort: Low.
2. **Per-tool status checks** — duplicate status logic in every trip-scoped tool.
   - Pros: each tool can tailor behavior.
   - Cons: easy to miss a tool or regress later.
   - Effort: Medium.

## Recommendation
Use Approach 1 and also sanitize non-published rows from active-trip choices so the inbound decision context does not leak draft titles, dates, slugs, itinerary counts, document counts, or confirmation data before publication.

## Risks
- Returning a blocked/non-success status would force current agent validation into human escalation. Use a successful safe planning payload that can be cited without exposing details.
- Existing tests assume one ownership query per trip tool; update fixtures for the new status read.

## Ready for Proposal
Yes — the change is bounded to the client tool contract and tests.

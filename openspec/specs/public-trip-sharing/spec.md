# Public Trip Sharing Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Share published itineraries with travelers through accountless public URLs while protecting private agent data.

## Requirements

### Requirement: Published-only public access

The system MUST render `/t/{slug}` only for trips whose status is `published`; draft, archived, or unknown slugs MUST return not found.

#### Scenario: View published trip

- GIVEN a trip is published and has a slug
- WHEN a traveler opens `/t/{slug}`
- THEN the public itinerary MUST render without requiring login

#### Scenario: Hide unpublished trip

- GIVEN a trip is draft or archived
- WHEN a traveler opens its public slug
- THEN the system MUST return a not-found response

### Requirement: Traveler itinerary content

The public page MUST show cover/title/date/traveler summary, configured contact email and phone, instructions, days, items, notes, confirmation details, maps or map links, weather, photos, and optional cost summary.

#### Scenario: Show public itinerary details

- GIVEN a published trip has days, items, photos, and contact settings
- WHEN the traveler opens the public page
- THEN they MUST see itinerary content and contact details

#### Scenario: Respect cost visibility

- GIVEN a trip has item costs
- WHEN `showCostsToClient` is false
- THEN costs MUST NOT be displayed to the traveler

### Requirement: Traveler actions

The public page MUST let travelers add items or the whole trip to calendar, switch supported language labels, and submit post-trip feedback.

#### Scenario: Submit feedback

- GIVEN a traveler is viewing a published trip
- WHEN they submit a 1-5 rating with optional comment
- THEN the feedback MUST be stored for the trip

#### Scenario: Reject invalid feedback

- GIVEN a traveler submits a rating outside 1-5
- WHEN the feedback action runs
- THEN the system MUST ignore the invalid submission

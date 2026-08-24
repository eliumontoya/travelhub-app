# Delta for Public Trip Sharing

## MODIFIED Requirements

### Requirement: Traveler itinerary content

The public page MUST show the trip's own cover image (its `coverImageUrl`), title, date, and traveler summary, configured contact email and phone, instructions, days, items, notes, confirmation details, maps or map links, weather, photos, and optional cost summary. The rendered cover MUST be the trip's per-trip image, NOT the client's cover.
(Previously: listed a generic "cover" without clarifying it is the trip's own per-trip `coverImageUrl`, not the client's cover — risk of #153 regression)

#### Scenario: Show public itinerary details

- GIVEN a published trip has days, items, photos, and contact settings
- WHEN the traveler opens the public page
- THEN they MUST see itinerary content and contact details

#### Scenario: Respect cost visibility

- GIVEN a trip has item costs
- WHEN `showCostsToClient` is false
- THEN costs MUST NOT be displayed to the traveler

#### Scenario: Render the trip's own cover, not the client's

- GIVEN a published trip has a `coverImageUrl` set and its client has a different client cover
- WHEN the traveler opens `/t/[slug]`
- THEN the hero and OpenGraph image MUST use the trip's `coverImageUrl`
- AND MUST NOT use the client's cover image

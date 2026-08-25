# Delta for public-trip-sharing

**Change**: bugfixes-162-163-166-168
**Type**: Delta spec (modified capability)

## ADDED Requirements

### Requirement: Draft traveler preview URL

The system MUST keep the final traveler URL `/t/{slug}` inactive for draft trips, while allowing the authenticated agent to open a temporary preview URL for draft review. Draft preview rendering MUST be visually identified as a preview and MUST NOT make copy/share controls expose the final public URL before publication.

#### Scenario: Draft final URL remains unavailable

- GIVEN a trip is still in draft
- WHEN `/t/{slug}` is opened without a preview token
- THEN the system MUST return a not-found response

#### Scenario: Draft preview URL renders for agent review

- GIVEN a trip is still in draft
- WHEN the agent opens the dashboard preview link with its temporary preview token
- THEN `/t/{slug}` MUST render the traveler view
- AND the page MUST show that it is a draft preview

#### Scenario: Published URL renders without preview token

- GIVEN a trip has status `published`
- WHEN a traveler opens `/t/{slug}`
- THEN the traveler view MUST render without requiring a preview token

### Requirement: Complete traveler item details

The public traveler itinerary MUST keep each item card scannable by showing primary details first (name, type, time, location, and type-specific summary) and MUST provide a non-intrusive way to reveal complete item details. Expanded item details MUST include every traveler-relevant field available for that item: notes, confirmation/reference values, costs when the trip allows cost visibility, structured metadata, supplier information, maps/coordinates, and item documents with download/view links when available.

#### Scenario: Expand item details

- GIVEN a published trip item has traveler-relevant notes, metadata, supplier details, map coordinates, or attached item documents
- WHEN a traveler opens the public itinerary
- THEN the item card MUST show a control to reveal more details
- AND expanding it MUST show the complete details without navigating away from the itinerary

#### Scenario: Keep item cards scannable

- GIVEN a published trip has multiple itinerary items
- WHEN the traveler scans the day list
- THEN each item MUST still show its name, type, time when present, location when present, and compact metadata summary before expansion

#### Scenario: Respect cost visibility in expanded details

- GIVEN an item has a cost
- WHEN `showCostsToClient` is false
- THEN the expanded item details MUST NOT show the cost

#### Scenario: Show item documents in details

- GIVEN a published trip item has attached documents with signed URLs
- WHEN the traveler expands the item details
- THEN the documents MUST appear as links within the item details

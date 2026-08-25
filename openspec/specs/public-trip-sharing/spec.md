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

### Requirement: Traveler itinerary content

The public page MUST show the trip's own cover image (its `coverImageUrl`), title, date, and traveler summary, configured contact email and phone, instructions, days, items, notes, confirmation details, maps or map links, weather, photos, optional cost summary, and packing checklist (when items exist). The rendered cover MUST be the trip's per-trip image, NOT the client's cover.

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

### Requirement: Public itinerary data access boundaries

The public `/t/{slug}` page MUST assemble traveler itinerary data using only tables and fields that are safe for anonymous access under public RLS policies. It MUST NOT query dashboard-only private relation tables such as `trip_clients`, `trip_tags`, `trip_status_history` during public traveler rendering. Public rendering MUST still include the trip's own `coverImageUrl` when set.

#### Scenario: Render published trip without private relation reads

- GIVEN a published trip has a `coverImageUrl`
- AND dashboard relation tables such as `trip_clients` deny anonymous access
- WHEN a traveler opens `/t/{slug}`
- THEN the public page MUST render without querying those private relation tables
- AND the top hero MUST use the trip's `coverImageUrl`

### Requirement: Agency branding on cover

The cover hero of `/t/{slug}` MUST render the agency's `logoUrl` and `agencyName` from `site_settings` when present. When both are absent, the cover MUST render without branding (no regression).

#### Scenario: Cover with agency branding

- GIVEN `logoUrl` and `agencyName` are configured in `site_settings`
- WHEN a traveler opens `/t/{slug}`
- THEN the cover hero MUST display the logo image and agency name in the top-left corner, without obscuring the trip title or dates

#### Scenario: Cover without agency branding

- GIVEN `logoUrl` or `agencyName` is empty in `site_settings`
- WHEN a traveler opens `/t/{slug}`
- THEN the cover MUST render as it does today (no branding overlay, no regression)

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

### Requirement: Public checklist visibility

The public trip page `/t/{slug}` MUST render the packing checklist when the trip has at least one packing item.

#### Scenario: Trip has packing items

- GIVEN a published trip has one or more packing items
- WHEN a traveler opens `/t/{slug}`
- THEN the packing checklist MUST be visible with every item's label

#### Scenario: Trip has no packing items

- GIVEN a published trip has zero packing items
- WHEN a traveler opens `/t/{slug}`
- THEN the packing checklist MUST NOT be rendered

### Requirement: Read-only public checklist

The public packing checklist MUST NOT expose add, delete, or server-persisted toggle actions to anonymous travelers.

#### Scenario: No add/delete controls

- GIVEN a traveler is viewing the public checklist
- WHEN the checklist renders
- THEN no "add item" input and no delete controls MUST be present

#### Scenario: Local-only toggle

- GIVEN a traveler toggles a packing item checkbox in the public view
- WHEN the toggle occurs
- THEN the checked state MUST update locally in the browser and MUST NOT be persisted to the server

### Requirement: Agent checklist unchanged

The authenticated dashboard packing checklist MUST retain add, toggle (persisted), and delete behavior.

#### Scenario: Agent toggles persist

- GIVEN an agent toggles a packing item in the dashboard
- WHEN the action completes
- THEN the new checked state MUST be persisted and re-rendered

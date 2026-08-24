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

The public page MUST show cover/title/date/traveler summary, configured contact email and phone, instructions, days, items, notes, confirmation details, maps or map links, weather, photos, optional cost summary, and packing checklist (when items exist).

#### Scenario: Show public itinerary details

- GIVEN a published trip has days, items, photos, and contact settings
- WHEN the traveler opens the public page
- THEN they MUST see itinerary content and contact details

#### Scenario: Respect cost visibility

- GIVEN a trip has item costs
- WHEN `showCostsToClient` is false
- THEN costs MUST NOT be displayed to the traveler

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

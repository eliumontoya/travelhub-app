# Delta Spec: traveler-logo-left-es-en

**Domain**: public-trip-sharing
**Baseline**: openspec/specs/public-trip-sharing/spec.md
**Change type**: Pure layout change on the public traveler page `/t/{slug}`. No data model, migration, settings, or new fields are in scope.

---

## ADDED Requirements

### Requirement: Traveler header layout

The public traveler page MUST display the agency branding (logo image and agency name, when configured) and the trip summary block together within the existing cover-image hero. The branding MUST appear on the LEFT side of the trip summary block (which holds the trip title, dates, traveler count, contact email, and phone).

When a `logoUrl` and/or `agencyName` are NOT configured, the header MUST degrade gracefully: the trip summary block MUST remain correctly displayed and the system SHALL NOT render a broken image or an empty logo placeholder.

The branding-and-summary arrangement MUST NOT introduce a new visible card border; it SHALL preserve the existing text-over-cover-image appearance.

On narrow viewports the branding and the summary block SHALL stack vertically rather than overlap or crowd.

#### Scenario: Branding shown left of summary when configured

- GIVEN a published trip has a configured `logoUrl` and `agencyName`
- WHEN the traveler opens `/t/{slug}`
- THEN the agency logo and name MUST appear on the LEFT of the trip summary block inside the cover hero

#### Scenario: Summary renders correctly without branding

- GIVEN a published trip has no configured `logoUrl` or `agencyName`
- WHEN the traveler opens `/t/{slug}`
- THEN the trip summary block MUST render correctly and the system SHALL NOT show a broken image or an empty logo placeholder

#### Scenario: No new visible card border

- GIVEN the public page header arrangement
- WHEN it is rendered
- THEN the branding-and-summary block MUST NOT show a new visible bordered card (the text-over-cover-image look is preserved)

#### Scenario: Responsive stacking on narrow viewports

- GIVEN the traveler views the page on a narrow viewport
- WHEN the header renders
- THEN the branding and the trip summary block SHALL stack vertically without overlap or crowding

---

## MODIFIED Requirements

### Requirement: Traveler actions

The public page MUST let travelers add items or the whole trip to calendar, switch supported language labels, and submit post-trip feedback.

The ES/EN language toggle MUST appear BELOW the header/hero block, on the light page surface (outside the cover hero), and it MUST remain visible there. The language toggle MUST be hidden in print output.

#### Scenario: Submit feedback

- GIVEN a traveler is viewing a published trip
- WHEN they submit a 1-5 rating with optional comment
- THEN the feedback MUST be stored for the trip

#### Scenario: Reject invalid feedback

- GIVEN a traveler submits a rating outside 1-5
- WHEN the feedback action runs
- THEN the system MUST ignore the invalid submission

#### Scenario: Language toggle position below header

- GIVEN a published trip
- WHEN the traveler opens `/t/{slug}`
- THEN the ES/EN language toggle MUST appear below the header/hero block on the light page surface and remain visible
- AND the language toggle MUST be hidden when the page is printed

---

## REMOVED Requirements

(No requirements removed by this change.)

## RENAMED Requirements

(No requirements renamed by this change.)

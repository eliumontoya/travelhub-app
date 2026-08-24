# Spec: Checklist visible to the client

**Baseline**: baseline-from-current-implementation

## Purpose

Make the trip packing checklist ("Checklist de equipaje") visible to travelers on
the public, accountless itinerary page (`/t/[slug]`), without allowing anonymous
mutations of the agent's data.

## Requirements

### Requirement: Public checklist visibility

The public trip page `/t/{slug}` MUST render the packing checklist when the trip
has at least one packing item.

#### Scenario: Trip has packing items

- GIVEN a published trip has one or more packing items
- WHEN a traveler opens `/t/{slug}`
- THEN the packing checklist MUST be visible with every item's label

#### Scenario: Trip has no packing items

- GIVEN a published trip has zero packing items
- WHEN a traveler opens `/t/{slug}`
- THEN the packing checklist MUST NOT be rendered

### Requirement: Read-only public checklist

The public packing checklist MUST NOT expose add, delete, or server-persisted
toggle actions to anonymous travelers.

#### Scenario: No add/delete controls

- GIVEN a traveler is viewing the public checklist
- WHEN the checklist renders
- THEN no "add item" input and no delete controls MUST be present

#### Scenario: Local-only toggle

- GIVEN a traveler toggles a packing item checkbox in the public view
- WHEN the toggle occurs
- THEN the checked state MUST update locally in the browser and MUST NOT be
  persisted to the server

### Requirement: Agent checklist unchanged

The authenticated dashboard packing checklist MUST retain add, toggle (persisted),
and delete behavior.

#### Scenario: Agent toggles persist

- GIVEN an agent toggles a packing item in the dashboard
- WHEN the action completes
- THEN the new checked state MUST be persisted and re-rendered

# Delta for Public Trip Sharing

**Baseline**: baseline-from-current-implementation

## ADDED Requirements

### Requirement: Eligible traveler sees service-document upload callout

The public trip page MUST render a compact document-upload callout immediately below the packing checklist only when the current viewer has a valid signed-in traveler session, that traveler is assigned to the trip, and the assigned service has at least one checklist requirement. The callout MUST link only to that traveler’s existing document-upload route and MUST NOT reveal another traveler’s requirements or service-document existence.

#### Scenario: Assigned traveler sees upload callout

- GIVEN a published trip has packing items and an assigned traveler session with at least one service requirement
- WHEN the traveler opens `/t/{slug}`
- THEN a document-upload callout appears below the packing checklist
- AND its link targets the assigned traveler’s document-upload flow

#### Scenario: Anonymous or unassigned viewer sees no callout

- GIVEN a published trip has service requirements
- WHEN an anonymous or unassigned viewer opens `/t/{slug}`
- THEN no document-upload callout or private requirement detail is rendered

#### Scenario: Assigned traveler with no requirements sees no callout

- GIVEN the current traveler is assigned to the trip but has zero checklist requirements
- WHEN the traveler opens `/t/{slug}`
- THEN the document-upload callout is not rendered

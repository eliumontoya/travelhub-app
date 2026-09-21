# Delta for Service Checklist Management

**Baseline**: baseline-from-current-implementation

## ADDED Requirements

### Requirement: Agent sees compact traveler document summaries

The dashboard MUST show one compact summary per traveler with traveler identity, processed/total checklist counts, and an awaiting-review count. Only uploads with status `uploaded` SHALL count as awaiting review; `re_upload_requested` items await the traveler and MUST NOT count.

#### Scenario: Summarize traveler progress

- GIVEN a traveler has four checklist items, two processed uploads, and one uploaded item
- WHEN the dashboard renders the trip summaries
- THEN that traveler shows `2/4` processed and `1` awaiting review

#### Scenario: Exclude requested re-uploads

- GIVEN a traveler has an upload with status `re_upload_requested`
- WHEN the dashboard calculates awaiting-review counts
- THEN that upload is not included in the awaiting-review count

### Requirement: Agent manages one traveler in a lazy bounded modal

The dashboard MUST fetch checklist detail only for the selected traveler. The selected traveler’s assignment, ordering, and review workflow MUST open in one accessible modal with a bounded viewport, internal scrolling, loading and mutation-error states, focus return, and Escape-to-close behavior.

#### Scenario: Open selected traveler detail

- GIVEN compact summaries are visible for multiple travelers
- WHEN the agent selects one traveler’s Documents control
- THEN only that traveler’s checklist detail is loaded and shown in the modal

#### Scenario: Render a long checklist accessibly

- GIVEN the selected traveler has more checklist rows than fit in the modal viewport
- WHEN the modal opens
- THEN the modal remains bounded and its checklist scrolls internally without hiding controls

### Requirement: Agent can assign one requirement to all travelers atomically

The agent MUST be able to create one checklist requirement for every service on a trip. The operation MUST validate all target services before writing and MUST either create one independent item per service or create none.

#### Scenario: Assign requirement to all travelers

- GIVEN a trip has three valid traveler services
- WHEN the agent assigns “Passport copy” to all travelers
- THEN exactly one independent checklist item is created for each service

#### Scenario: Reject partial bulk assignment

- GIVEN a trip includes an invalid or unavailable service target
- WHEN the agent submits an all-traveler assignment
- THEN the operation is rejected and no service receives the new item

### Requirement: Service checklist management follows trip lifecycle

Authenticated agents MUST be authorized to create, edit, delete, reorder, or bulk-assign checklist items on draft and published trips independently of itinerary editability. Archived trips MUST be read-only for these mutations.

#### Scenario: Manage checklist on published trip

- GIVEN a trip is published
- WHEN the agent edits or reorders a checklist item
- THEN the mutation succeeds and the updated checklist is persisted

#### Scenario: Reject archived checklist mutation

- GIVEN a trip is archived
- WHEN the agent attempts a checklist mutation
- THEN the operation is rejected and checklist data is unchanged

# Delta for Public Trip Sharing

## MODIFIED Requirements

### Requirement: Eligible traveler activity controls

The public page MUST show activity controls only to a traveler with a valid PIN session and assignment to the published trip. Edit and delete controls MUST be limited to that traveler's activities; anonymous and unassigned viewers MUST retain read-only access.

**Clarification:** The add-activity form MUST NOT be visible under every day by default. Each day SHOULD show a compact `+ Add activity to this day` call to action. Activating it MUST reveal an inline form for that selected day, with at most one day-level add-activity form expanded at a time. This inline expansion is preferred over a modal because it preserves day context while reducing mobile vertical clutter.

#### Scenario: Eligible traveler sees owned controls

- GIVEN an assigned traveler has a valid PIN session for a published trip
- WHEN they open `/t/{slug}`
- THEN activity creation controls MUST be available
- AND edit/delete controls MUST appear only for activities they created

#### Scenario: Anonymous traveler remains read-only

- GIVEN a traveler has no valid PIN session
- WHEN they view a published trip and attempt to create an activity
- THEN the itinerary MUST render
- AND the mutation MUST be rejected without persistence

#### Scenario: Add-activity forms are collapsed by default

- GIVEN an eligible traveler opens a published trip with multiple days
- WHEN the itinerary renders
- THEN each day MUST NOT show a full add-activity form by default
- AND each eligible day SHOULD show a compact `+ Add activity to this day` control

#### Scenario: Add-activity form expands for one selected day

- GIVEN an eligible traveler is viewing the day list
- WHEN they activate `+ Add activity to this day` for a specific day
- THEN an add-activity form MUST be revealed for that day
- AND the form MUST be visually associated with that day
- AND any previously expanded day-level add-activity form SHOULD collapse

#### Scenario: Mobile itinerary remains scannable

- GIVEN an eligible traveler views `/t/{slug}` on a narrow mobile viewport
- WHEN no add-activity form is expanded
- THEN the visible itinerary MUST prioritize day content and compact activity controls over repeated forms

### Requirement: Traveler actions

The public page MUST let travelers add items or the whole trip to calendar, switch supported language labels, submit post-trip feedback, and access traveler authentication from the lock icon when needed.

**Clarification:** The lock icon on `/t/{slug}` MUST respect the current client session. Anonymous travelers MAY be sent to `/client/login`; travelers who already have a valid client session MUST be sent to the main client home screen at `/client` instead of the login page.

#### Scenario: Submit feedback

- GIVEN a traveler is viewing a published trip
- WHEN they submit a 1-5 rating with optional comment
- THEN the feedback MUST be stored for the trip

#### Scenario: Reject invalid feedback

- GIVEN a traveler submits a rating outside 1-5
- WHEN the feedback action runs
- THEN the system MUST ignore the invalid submission

#### Scenario: Authenticated traveler lock icon opens client home

- GIVEN a traveler has a valid client session cookie
- WHEN they click the lock icon on `/t/{slug}`
- THEN they MUST be routed to `/client`
- AND they MUST NOT be routed to `/client/login`

#### Scenario: Anonymous traveler lock icon opens login

- GIVEN a traveler has no valid client session cookie
- WHEN they click the lock icon on `/t/{slug}`
- THEN they MAY be routed to `/client/login`

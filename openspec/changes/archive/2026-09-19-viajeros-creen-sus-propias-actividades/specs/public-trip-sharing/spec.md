# Delta for Public Trip Sharing

## ADDED Requirements

### Requirement: Eligible traveler activity controls

The public page MUST show activity controls only to a traveler with a valid PIN session and assignment to the published trip. Edit and delete controls MUST be limited to that traveler's activities; anonymous and unassigned viewers MUST retain read-only access.

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

### Requirement: Public activity visibility

Traveler-created activities MUST be rendered as ordinary public itinerary items after creation. Unpublishing or archiving a trip MUST stop traveler mutations without deleting stored activities.

#### Scenario: Activity appears to trip viewers

- GIVEN an assigned traveler created an activity on a published trip
- WHEN any viewer opens the public trip URL
- THEN the activity MUST appear with its title and supplied time, location, and notes

#### Scenario: Lifecycle stops writes but preserves data

- GIVEN a trip with a traveler-created activity is unpublished or archived
- WHEN the traveler attempts another mutation
- THEN the mutation MUST be rejected
- AND the existing activity MUST remain stored

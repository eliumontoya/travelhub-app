# Delta for Trip Itinerary

## ADDED Requirements

### Requirement: Traveler activity authorization and attribution

Assigned travelers MAY create, edit, and delete activity items only with a valid PIN session, on a published trip day assigned to them. They MUST NOT modify days, non-activity items, or others' items. Creator attribution MUST be nullable: existing and agent-created items use null, while traveler-created activities identify the client. Agent operations and published-trip locking MUST remain unchanged.

#### Scenario: Traveler creates an attributed activity

- GIVEN an assigned traveler has a valid PIN session for a published trip day
- WHEN they submit an activity with a title and optional time, location, and notes
- THEN the activity MUST be created with that traveler as creator

#### Scenario: Ownership and scope are enforced

- GIVEN an activity belongs to another traveler or the agent
- WHEN a traveler attempts to edit or delete it, or mutate a wrong-day/unpublished trip
- THEN the mutation MUST be rejected and the item MUST remain unchanged

#### Scenario: Existing items remain compatible

- GIVEN an existing agent item is migrated
- WHEN its creator attribution is read
- THEN it MUST be null and the item MUST remain agent-manageable

#### Scenario: Agent published lock remains effective

- GIVEN a trip is published
- WHEN the agent attempts an itinerary action edit
- THEN the existing published-trip lock MUST reject the edit

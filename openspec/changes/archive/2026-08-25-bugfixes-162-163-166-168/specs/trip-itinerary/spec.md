# Delta for trip-itinerary

**Change**: bugfixes-162-163-166-168
**Type**: Delta spec (modified capability)

## ADDED Requirements

### Requirement: Day notes visibility

The system MUST render trip day notes anywhere the day itinerary is reviewed by the agent or traveler. Day notes MUST appear discreetly near the day header without disrupting the itinerary card structure and MUST use the shared safe rich-note renderer.

#### Scenario: Agent sees day notes in trip editor

- GIVEN a trip day has notes
- WHEN the agent opens `/dashboard/trips/{id}`
- THEN the day notes MUST be visible near that day's heading

#### Scenario: Traveler sees day notes in public itinerary

- GIVEN a published trip day has notes
- WHEN a traveler opens `/t/{slug}`
- THEN the day notes MUST be visible near that day's heading

### Requirement: Rich note formatting fidelity

The rich-note pipeline MUST preserve safe traveler-useful formatting across write, sanitize, and render steps, including bold, italic, underline, lists, links, and pasted tables. The editor toolbar MUST apply formatting to the user's current text selection reliably.

#### Scenario: Pasted table remains a table

- GIVEN the agent pastes a simple table into a rich note field
- WHEN the note is saved and rendered
- THEN the table structure MUST be preserved with safe table markup
- AND unsafe attributes or scripts MUST be stripped

#### Scenario: Toolbar formatting applies to selected text

- GIVEN the agent selects text inside a rich note editor
- WHEN the agent clicks a toolbar formatting control such as bold
- THEN the selected text MUST receive the intended formatting

## MODIFIED Requirements

### Requirement: Trip lifecycle and reuse

The system MUST support draft, published, and archived status transitions, status history, save-as-template, duplicate-from-template, quote printing, draft traveler previews, and published-trip edit locking.

#### Scenario: Publish an itinerary

- GIVEN a draft trip has a public slug
- WHEN the agent publishes it
- THEN public access by `/t/{slug}` MUST become available

#### Scenario: Published itinerary is locked from editing

- GIVEN a trip has status `published`
- WHEN the agent opens the trip editor
- THEN day, item, media, packing, and itinerary action edits MUST be unavailable
- AND server actions for those edits MUST reject direct mutation attempts

#### Scenario: Return published itinerary to draft before editing

- GIVEN a trip has status `published`
- WHEN the agent needs to edit itinerary content
- THEN the agent MUST first transition the trip back to `draft`

## ADDED Requirements

### Requirement: WCC integrated polish and navigation
The WCC MVP MUST present dashboard, contacts, conversations, escalations, and knowledge as cohesive, navigable sections with active navigation state and no dead-end operational pages.

#### Scenario: Agent navigates WCC sections
- GIVEN an authenticated agent is viewing any WCC route
- WHEN the agent uses the WCC navigation
- THEN every WCC section link MUST point to its implemented route
- AND the current section SHOULD be visually indicated.

#### Scenario: Agent follows related context
- GIVEN a WCC page renders a related contact, conversation, escalation context, or linked TravelHub client with an existing destination route
- WHEN the agent selects the related context
- THEN the app MUST navigate to the related detail page without exposing new mutation controls.

### Requirement: WCC safe empty and unavailable states
WCC pages MUST render clear safe states when Supabase is unconfigured, a WhatsApp table is unavailable, a record is missing, or a filter has no results.

#### Scenario: Empty data remains actionable
- GIVEN WCC data is absent or filtered to zero records
- WHEN the agent opens a WCC page
- THEN the page MUST explain what is missing
- AND SHOULD provide a safe link to a related WCC section when useful.

#### Scenario: Configured reads fail safely
- GIVEN Supabase is configured but a WCC read fails
- WHEN the agent opens the affected WCC route
- THEN the page MUST show a non-destructive unavailable state instead of throwing.

### Requirement: WCC responsive QA baseline
The WCC MVP SHOULD keep section pages readable on a narrow mobile viewport without requiring horizontal table headers for core content.

#### Scenario: Agent opens WCC on mobile width
- GIVEN the viewport is narrow
- WHEN the agent opens WCC list pages
- THEN core rows and empty states SHOULD remain readable without exposing desktop-only table headers as required navigation context.

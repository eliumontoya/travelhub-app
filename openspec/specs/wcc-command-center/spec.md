# WCC Command Center Specification

**Baseline**: baseline-from-current-implementation

## Purpose
Provide an authenticated WhatsApp Command Control shell for monitoring WhatsApp operations without changing inbound bot behavior.

## Requirements

### Requirement: Authenticated WCC navigation entry
The system MUST expose `WhatsApp C.C.` from the authenticated TravelHub dashboard nav and link it to `/dashboard/wcc` without removing existing destinations.

#### Scenario: Agent opens WCC
- GIVEN an authenticated agent is inside `/dashboard`
- WHEN they use `WhatsApp C.C.`
- THEN the app MUST navigate to `/dashboard/wcc`.

### Requirement: Dedicated WCC shell
The system MUST render `/dashboard/wcc` with WCC navigation and a `TravelHub` link back to `/dashboard`.

#### Scenario: Agent returns to TravelHub
- GIVEN the agent is viewing `/dashboard/wcc`
- WHEN they use `TravelHub`
- THEN the app MUST navigate to `/dashboard`.

### Requirement: WCC operational dashboard
The system MUST render read-only KPIs for open escalations, recent conversations, recent contacts, knowledge entries by status, and pending/failed messages when data exists.

#### Scenario: Render without data
- GIVEN Supabase is not configured or WhatsApp rows are absent
- WHEN the agent opens `/dashboard/wcc`
- THEN the dashboard MUST render zero counts and empty states without errors.

### Requirement: WCC scope isolation
The WCC shell MUST NOT implement contacts, escalations, conversations, or knowledge CRUD, and MUST NOT change inbound bot/webhook behavior.

#### Scenario: Future sections remain placeholders
- GIVEN the agent views WCC
- WHEN contacts, conversations, escalations, or knowledge are shown
- THEN those entries MUST be placeholders or non-CRUD links for future issues.

## ADDED Requirements

### Requirement: WCC escalations queue
The system MUST render `/dashboard/wcc/escalations` as a read-only queue of WhatsApp escalations ordered by newest `opened_at` first.

#### Scenario: Agent triages recent escalation
- GIVEN WhatsApp escalations exist
- WHEN the agent opens `/dashboard/wcc/escalations`
- THEN the system MUST show each escalation reason or summary, priority, status, related contact identity, opened date, and related context links.

#### Scenario: Agent filters queue
- GIVEN escalations exist with different statuses and priorities
- WHEN the agent applies a supported status or priority filter
- THEN the system MUST limit the queue to matching escalations without enabling mutation controls.

#### Scenario: Escalations empty or unavailable
- GIVEN Supabase is unconfigured, WhatsApp data is absent, or the read fails
- WHEN the agent opens `/dashboard/wcc/escalations`
- THEN the page MUST render a safe empty or unavailable state without throwing.

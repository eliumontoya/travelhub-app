# Delta for Dashboard Workspace

## MODIFIED Requirements

### Requirement: Dashboard overview

The dashboard MUST show travel KPIs, unpublished-upcoming alerts, birthdays, referral-source counts, trip trends, integration status, recent activity, command palette, theme toggle, changelog entry point, and a compact trip status history preview.

**Clarification:** The status history section on `/dashboard` MUST show only the latest three entries by default so the dashboard remains scannable. Entries MUST be ordered newest first or otherwise clearly represent the three most recent status history records.

#### Scenario: View business overview

- GIVEN the agent opens `/dashboard`
- WHEN data is available from Supabase or mock mode
- THEN the dashboard MUST show KPI cards and supporting widgets

#### Scenario: Warn about soon-starting drafts

- GIVEN a draft trip starts within the configured upcoming window
- WHEN the dashboard loads
- THEN the dashboard MUST show an unpublished-trip alert linking to the editor

#### Scenario: Show only latest three status history entries

- GIVEN more than three status history entries exist
- WHEN the agent opens `/dashboard`
- THEN the status history section MUST render no more than three entries
- AND the rendered entries MUST correspond to the latest three status history records

#### Scenario: Show all entries when there are three or fewer

- GIVEN three or fewer status history entries exist
- WHEN the agent opens `/dashboard`
- THEN the status history section MUST render all available entries

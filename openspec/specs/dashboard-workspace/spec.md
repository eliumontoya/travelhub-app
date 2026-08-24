# Dashboard Workspace Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Provide an authenticated operational workspace for monitoring, searching, filtering, and acting on TravelHub business data.

## Requirements

### Requirement: Dashboard overview

The dashboard MUST show travel KPIs, unpublished-upcoming alerts, birthdays, referral-source counts, trip trends, integration status, recent activity, command palette, theme toggle, and changelog entry point.

#### Scenario: View business overview

- GIVEN the agent opens `/dashboard`
- WHEN data is available from Supabase or mock mode
- THEN the dashboard MUST show KPI cards and supporting widgets

#### Scenario: Warn about soon-starting drafts

- GIVEN a draft trip starts within the configured upcoming window
- WHEN the dashboard loads
- THEN the dashboard MUST show an unpublished-trip alert linking to the editor

### Requirement: Trip explorer

The system MUST provide `/dashboard/trips` with paginated trip search and filters for query, status, dates, clients, tags, and currency.

#### Scenario: Filter trips

- GIVEN trips exist with different statuses, clients, tags, and dates
- WHEN the agent applies filters
- THEN the trip list MUST contain only matching trips

#### Scenario: Paginate trips

- GIVEN more trips match than fit on one page
- WHEN the agent navigates to another page
- THEN the route query MUST preserve filters and show that page

### Requirement: Bulk and board actions

The dashboard workspace MUST support moving trip status from board interactions and bulk publishing or archiving selected trips.

#### Scenario: Move trip status

- GIVEN a trip is visible in the dashboard board
- WHEN the agent moves it to another status column
- THEN the trip status MUST update through the shared trip update path

#### Scenario: Bulk update status

- GIVEN the agent selected multiple trips
- WHEN they run a bulk publish or archive action
- THEN every selected trip MUST receive the requested status

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

The system MUST provide `/dashboard/trips` with paginated trip search and filters for query, status, dates, clients, tags, currency, and travel agents. The travel-agent filter MUST accept one or more agents and MUST be reflected in the URL query parameters so the filter state is shareable and bookmarkable.

#### Scenario: Filter trips

- GIVEN trips exist with different statuses, clients, tags, and dates
- WHEN the agent applies filters
- THEN the trip list MUST contain only matching trips

#### Scenario: Paginate trips

- GIVEN more trips match than fit on one page
- WHEN the agent navigates to another page
- THEN the route query MUST preserve filters and show that page

#### Scenario: Filter trips by travel agent

- GIVEN trips exist with different assigned agents (including unassigned)
- WHEN the agent selects one or more travel agents in the filter
- THEN only trips assigned to at least one selected agent MUST appear

#### Scenario: Filter with zero matching agents

- GIVEN no trips are assigned to the selected agent
- WHEN the agent applies that agent filter
- THEN the trip list MUST be empty and the filter badge MUST remain visible

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

### Requirement: Site branding settings

`SiteSettings` MUST include `agencyName` and `logoUrl` fields, persisted in the `site_settings` singleton table. The `/dashboard/settings` form MUST allow editing the agency name and uploading or manually entering a logo URL. When Supabase is not configured, the logo MUST be settable via manual URL only.

#### Scenario: Read site branding defaults

- GIVEN Supabase is not configured
- WHEN `getSiteSettings()` is called
- THEN `agencyName` and `logoUrl` MUST return empty strings

#### Scenario: Update site branding

- GIVEN valid branding fields
- WHEN `updateSiteSettings({ agencyName, logoUrl })` is called
- THEN the singleton row MUST be updated and `/t/[slug]` MUST be revalidated

#### Scenario: Dashboard settings form with branding

- GIVEN an authenticated agent on `/dashboard/settings`
- WHEN they enter an agency name and upload a logo (or paste a URL)
- THEN `agencyName` and `logoUrl` MUST persist and the cover MUST reflect them

#### Scenario: Manual logo URL without Supabase

- GIVEN Supabase is not configured
- WHEN the agent pastes a manual logo URL
- THEN `logoUrl` MUST be saved without a Storage upload

### Requirement: Settings save redirect confirmation

The system MUST redirect the authenticated agent to the dashboard after settings are saved successfully and MUST show a success confirmation there.

#### Scenario: Successful settings save redirects to dashboard

- GIVEN an authenticated agent submits valid settings on `/dashboard/settings`
- WHEN the settings are persisted successfully
- THEN the system MUST redirect the agent to `/dashboard`
- AND the dashboard MUST show a confirmation that the settings were saved successfully

#### Scenario: Failed settings save stays on settings form

- GIVEN an authenticated agent submits invalid settings or a save dependency fails
- WHEN the settings are not persisted successfully
- THEN the system MUST keep the agent on the settings form with an error message
- AND the dashboard success confirmation MUST NOT be shown
### Requirement: Feature-gated navigation

The dashboard navigation MUST render each feature nav link — Viajes (`trips`), Clientes (`clients`), Proveedores (`suppliers`), Agentes (`travel-agents`), WhatsApp C.C. (`whatsapp`), and Ajustes (`settings`) — only when the current account can access that link's feature. The Dashboard home link MUST be rendered unconditionally for every authenticated account with a valid role.

#### Scenario: Admin sees all feature links

- GIVEN an authenticated admin account
- WHEN the dashboard layout renders the navigation
- THEN every feature nav link MUST be visible

#### Scenario: Agent sees only assigned feature links

- GIVEN an agent account with only the `trips` feature assigned
- WHEN the dashboard layout renders the navigation
- THEN only the Viajes link MUST be visible among the feature links

#### Scenario: Dashboard home link always visible

- GIVEN any authenticated account with a valid role, including one with no features assigned
- WHEN the dashboard layout renders the navigation
- THEN the Dashboard home link MUST be visible

#### Scenario: Agent with no features sees only home

- GIVEN an agent account with no features assigned
- WHEN the dashboard layout renders the navigation
- THEN none of the six feature nav links MUST be visible
- AND the Dashboard home link MUST remain visible

# Delta for Dashboard Workspace

## MODIFIED Requirements

### Requirement: Trip explorer

The system MUST provide `/dashboard/trips` with paginated trip search and filters for query, status, dates, clients, tags, currency, and travel agents. The travel-agent filter MUST accept one or more agents and MUST be reflected in the URL query parameters so the filter state is shareable and bookmarkable.

(Previously: Trip explorer filters covered query, status, dates, clients, tags, and currency — but no travel-agent filter.)

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

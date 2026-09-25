# Delta for Dashboard Workspace

## ADDED Requirements

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

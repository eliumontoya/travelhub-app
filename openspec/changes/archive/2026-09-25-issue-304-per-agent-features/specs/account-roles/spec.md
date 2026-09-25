# Delta for Account Roles

## ADDED Requirements

### Requirement: Feature model

The system MUST define a fixed catalog of exactly six features — `trips`, `clients`, `suppliers`, `travel-agents`, `whatsapp`, and `settings` — as a typed `Feature` union and an ordered `AVAILABLE_FEATURES` constant that is the single source of truth for every feature-aware surface (navigation, route guards, and the admin management UI). The `features` field of an account profile MUST be typed as a list of these recognized `Feature` values. When resolving an account from the database, any feature string that is not in the catalog MUST be silently discarded rather than exposed to feature checks.

#### Scenario: Fixed feature catalog

- GIVEN the system's feature model
- WHEN feature-aware code enumerates the available features
- THEN the catalog MUST contain exactly the six features `trips`, `clients`, `suppliers`, `travel-agents`, `whatsapp`, and `settings`

#### Scenario: Unknown database feature discarded

- GIVEN a persisted profile whose `features` array contains a value not in the catalog
- WHEN the system resolves that account
- THEN the unknown value MUST be dropped from the resolved `features` list
- AND the remaining recognized features MUST be preserved

### Requirement: Feature-level route enforcement

The system MUST enforce feature access at the route level, not only in navigation. A server-side guard MUST resolve the current account and MUST deny (redirect away from the route) any request to a gated dashboard route when the account cannot access that route's feature. The guard MUST evaluate through the same account-resolution path in both Supabase and mock mode so enforcement is identical in each mode.

#### Scenario: Agent redirected from gated route

- GIVEN an agent account that does not have the `settings` feature assigned
- WHEN the agent requests `/dashboard/settings` directly
- THEN the system MUST redirect the agent away from the route

#### Scenario: Admin passes route guard

- GIVEN an admin account
- WHEN the admin requests any gated dashboard route
- THEN the route MUST be allowed to render

#### Scenario: Missing account fails route guard

- GIVEN a request where no account can be resolved
- WHEN a gated route's guard runs
- THEN the request MUST be denied

## MODIFIED Requirements

### Requirement: Agent feature-level access

The system MUST support configurable feature assignments per account. Feature access MUST be evaluated per account as follows: the `admin` role MUST have access to every feature regardless of assignment; an `agent` MUST have access only to features explicitly assigned to their account; and a null or absent profile MUST have access to no feature. No feature MUST be implicitly accessible to an agent beyond the features explicitly assigned.

(Previously: permitted "deny access OR hide the feature" and did not specify null-profile or strict no-feature-is-always-on semantics.)

#### Scenario: Agent accesses assigned feature

- GIVEN an agent account with feature `trips` assigned
- WHEN the agent navigates to the trips section
- THEN the system MUST allow access

#### Scenario: Agent denied unassigned feature

- GIVEN an agent account without feature `settings` assigned
- WHEN the agent attempts to access the settings section
- THEN the system MUST deny access to the section
- AND the section MUST be hidden from that agent's navigation

#### Scenario: Admin accesses every feature

- GIVEN an admin account with no features explicitly assigned
- WHEN the admin accesses any feature section
- THEN the system MUST allow access to every feature

#### Scenario: Null profile has no feature access

- GIVEN a resolved profile that is null or absent
- WHEN feature access is evaluated
- THEN the system MUST deny access to every feature

### Requirement: Mock-mode role parity

The system MUST enforce the same role and feature model in mock mode (Supabase not configured) as in Supabase mode. Mock accounts MUST carry role and feature metadata, MUST honor the same fixed feature catalog, MUST apply the same defensive filtering of unknown feature strings, and MUST enforce the same route-level feature guard.

(Previously: mock parity covered only role and feature metadata, not the feature catalog, defensive filtering, or the route guard.)

#### Scenario: Mock admin access

- GIVEN Supabase is not configured and the mock account has role `admin`
- WHEN the user opens `/dashboard`
- THEN the system MUST allow full dashboard access

#### Scenario: Mock agent restricted access

- GIVEN Supabase is not configured and the mock account has role `agent` with limited features
- WHEN the user opens `/dashboard`
- THEN the system MUST restrict access to assigned features only

#### Scenario: Mock route guard enforcement

- GIVEN Supabase is not configured and the mock agent lacks a gated route's feature
- WHEN the mock agent requests that gated route directly
- THEN the system MUST redirect the agent away from the route

#### Scenario: Mock feature catalog parity

- GIVEN Supabase is not configured
- WHEN the mock account's features are resolved
- THEN the resolved features MUST be drawn from the same six-feature catalog and unknown values MUST be discarded

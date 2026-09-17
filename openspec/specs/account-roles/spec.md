# Account Roles Specification

## Purpose

Define the role model for TravelHub accounts: `admin` (full access) and `agent` (feature-level access), role-based authorization on dashboard routes, the account-to-`travel_agents` mapping, and mock-mode role parity.

## Requirements

### Requirement: Role enumeration

The system MUST recognize exactly two account roles: `admin` and `agent`. Every authenticated account MUST have exactly one role. Accounts with no recognized role MUST NOT be treated as either.

#### Scenario: Admin role identified

- GIVEN an authenticated account with role `admin`
- WHEN the system resolves the account role
- THEN the resolved role MUST be `admin`

#### Scenario: Unknown or missing role

- GIVEN an authenticated account with no role or an unrecognized role value
- WHEN the system resolves the account role
- THEN the system MUST treat the account as having no valid role

### Requirement: Dashboard role enforcement

The system MUST deny dashboard access to any authenticated user who does not have a valid role (`admin` or `agent`). A valid role is necessary in addition to a valid authentication session.

#### Scenario: Authenticated user with no role denied

- GIVEN an authenticated session exists but the account has no valid role
- WHEN the user requests a `/dashboard/**` route
- THEN the system MUST redirect the user away from the dashboard

#### Scenario: Agent reaches dashboard

- GIVEN an authenticated account with role `agent`
- WHEN the user requests a `/dashboard/**` route
- THEN the dashboard route MUST be allowed to render

### Requirement: Agent feature-level access

The system MUST support configurable feature assignments per agent account. An agent MUST only access features assigned to their account. The admin role MUST have access to all features regardless of assignment.

#### Scenario: Agent accesses assigned feature

- GIVEN an agent account with feature `trips` assigned
- WHEN the agent navigates to the trips section
- THEN the system MUST allow access

#### Scenario: Agent denied unassigned feature

- GIVEN an agent account without feature `settings` assigned
- WHEN the agent attempts to access the settings section
- THEN the system MUST deny access or hide the feature

### Requirement: Account to travel_agents mapping

The system MUST support linking an `agent` account to exactly one `travel_agents` record. The mapping MUST be queryable to resolve the agent's catalog identity from their account.

#### Scenario: Agent linked to travel_agents record

- GIVEN an agent account linked to travel_agents record with id `A1`
- WHEN the system resolves the agent's catalog identity
- THEN the resolved `travel_agents` id MUST be `A1`

#### Scenario: Agent without catalog link

- GIVEN an agent account with no `travel_agents` mapping
- WHEN the system resolves the agent's catalog identity
- THEN the result MUST be null and the account MUST remain functional

### Requirement: Mock-mode role parity

The system MUST enforce the same role model in mock mode (Supabase not configured) as in Supabase mode. Mock accounts MUST carry role and feature metadata.

#### Scenario: Mock admin access

- GIVEN Supabase is not configured and the mock account has role `admin`
- WHEN the user opens `/dashboard`
- THEN the system MUST allow full dashboard access

#### Scenario: Mock agent restricted access

- GIVEN Supabase is not configured and the mock account has role `agent` with limited features
- WHEN the user opens `/dashboard`
- THEN the system MUST restrict access to assigned features only

### Requirement: Public route anonymity preserved

Public routes `/t/{slug}` and `/c/{slug}` MUST remain accessible without authentication or any role. Role enforcement MUST NOT apply to these routes.

#### Scenario: Anonymous public trip read

- GIVEN no authenticated session exists
- WHEN a visitor requests `/t/{slug}` or `/c/{slug}`
- THEN the system MUST serve the public content without requiring authentication or a role

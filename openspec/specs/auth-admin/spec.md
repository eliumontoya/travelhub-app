# Auth Admin Specification

**Baseline**: baseline-from-current-implementation

## Purpose

Protect agent-only dashboard operations while allowing local development without Supabase configuration.

## Requirements

### Requirement: Dashboard authentication

The system MUST protect `/dashboard/**` with Supabase authentication when Supabase environment variables are configured.

#### Scenario: Redirect unauthenticated dashboard visitor

- GIVEN Supabase is configured and the visitor has no authenticated session
- WHEN they request a dashboard route
- THEN the system MUST redirect them to `/login` with the original path as `redirectTo`

#### Scenario: Allow authenticated dashboard visitor

- GIVEN Supabase is configured and the visitor has a valid session
- WHEN they request a dashboard route
- THEN the dashboard route MUST be allowed to render

### Requirement: Mock-mode development access

The system MUST allow dashboard access without authentication when Supabase is not configured so the app remains usable with mock data.

#### Scenario: Open dashboard in mock mode

- GIVEN Supabase URL or anon key is missing
- WHEN a developer opens `/dashboard`
- THEN the middleware MUST allow the request instead of redirecting to login

### Requirement: Login and sign-out

The system MUST provide email/password login through Supabase and sign-out from dashboard settings/profile controls.

#### Scenario: Successful login

- GIVEN Supabase is configured and credentials are valid
- WHEN the user submits the login form
- THEN the system MUST create a session and redirect to `redirectTo` or `/dashboard`

#### Scenario: Supabase missing on login

- GIVEN Supabase is not configured
- WHEN the user submits the login form
- THEN the system MUST return to login with a configuration error

### Requirement: Site contact settings

The system MUST let the authenticated agent update public contact email and phone used by public trip pages.

#### Scenario: Update contact settings

- GIVEN the agent opens settings
- WHEN they submit a valid email and phone
- THEN the public trip contact details MUST use the updated values

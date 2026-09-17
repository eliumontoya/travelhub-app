# Delta for Auth Admin

## MODIFIED Requirements

### Requirement: Dashboard authentication

The system MUST protect `/dashboard/**` with Supabase authentication AND a valid account role (`admin` or `agent`) when Supabase environment variables are configured. Authentication alone is not sufficient; the account MUST carry a recognized role.

#### Scenario: Redirect unauthenticated dashboard visitor

- GIVEN Supabase is configured and the visitor has no authenticated session
- WHEN they request a dashboard route
- THEN the system MUST redirect them to `/login` with the original path as `redirectTo`

#### Scenario: Authenticated user with valid role allowed

- GIVEN Supabase is configured and the visitor has a valid session with role `admin` or `agent`
- WHEN they request a dashboard route
- THEN the dashboard route MUST be allowed to render

#### Scenario: Authenticated user with no role denied

- GIVEN Supabase is configured and the visitor has a valid session but no recognized role
- WHEN they request a dashboard route
- THEN the system MUST redirect them away from the dashboard with an authorization error

(Previously: any valid authenticated session was sufficient for dashboard access; now a valid role is also required.)

### Requirement: Mock-mode development access

The system MUST allow dashboard access without Supabase authentication when Supabase is not configured, AND MUST enforce the same role model as Supabase mode. Mock accounts MUST carry role metadata; mock-mode role enforcement MUST match production behavior.

#### Scenario: Open dashboard in mock mode with valid role

- GIVEN Supabase URL or anon key is missing and the mock account has role `admin` or `agent`
- WHEN a developer opens `/dashboard`
- THEN the middleware MUST allow the request

#### Scenario: Open dashboard in mock mode with no role

- GIVEN Supabase is not configured and the mock account has no recognized role
- WHEN a developer opens `/dashboard`
- THEN the middleware MUST deny access

(Previously: mock mode allowed unrestricted dashboard access; now it enforces role validation.)

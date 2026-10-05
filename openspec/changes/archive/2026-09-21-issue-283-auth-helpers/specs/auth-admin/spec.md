# Delta for Auth Admin

## ADDED Requirements

### Requirement: Server Action authorization boundary

Every mutating Server Action under `src/app/dashboard/**` MUST authorize the caller inside the action, before reading or writing data, using a throw-style helper from the authorization module. The middleware session/role gate protects page navigations and the Server Action POSTs that share a dashboard path, but it is a coarse path-based filter that does not evaluate feature access and cannot express per-action intent; therefore it MUST NOT be treated as the authorization boundary for Server Actions. The action families that today have no per-action check MUST gain an explicit role check: `clients`, `clients/[id]`, `suppliers`, `travel-agents`, `trips/new`, the trip detail actions (`src/app/dashboard/trips/[id]/actions.ts`), the dashboard status actions (`src/app/dashboard/actions.ts`), `wcc/knowledge`, and `settings` (except `signOutAction`). For the trip detail family, the editability rule (`assertTripEditable`) is a separate concern: it MUST NOT be treated as authorization, and a mutation MUST require an allowed role even when the target trip passes the editability check.

#### Scenario: Previously unguarded clients action denies

- GIVEN a caller without a valid account role
- WHEN a clients mutation Server Action is invoked directly
- THEN the action MUST throw
- AND it MUST NOT mutate data

#### Scenario: Previously unguarded suppliers action denies

- GIVEN a caller without a valid account role
- WHEN a suppliers mutation Server Action is invoked directly
- THEN the action MUST throw
- AND it MUST NOT mutate data

#### Scenario: Previously unguarded trip creation denies

- GIVEN a caller without a valid account role
- WHEN `createTripAction` is invoked directly
- THEN the action MUST throw
- AND it MUST NOT create a trip

#### Scenario: Previously unguarded trip detail action denies

- GIVEN a caller without a valid account role
- WHEN a trip detail mutation Server Action under `src/app/dashboard/trips/[id]/actions.ts` is invoked directly
- THEN the action MUST throw
- AND it MUST NOT mutate the trip, its days, items, services, or documents

#### Scenario: Editability does not substitute for authorization

- GIVEN a caller without a valid account role
- AND the target trip is editable (it is not published, so the editability check would pass)
- WHEN a trip detail mutation Server Action is invoked directly
- THEN the action MUST still throw before performing the operation
- AND it MUST NOT mutate the trip

#### Scenario: Previously unguarded trip detail action runs for a valid role

- GIVEN an authenticated account with role `admin` or `agent`
- AND the target trip is editable
- WHEN a trip detail mutation Server Action is invoked with valid input
- THEN the action MUST run exactly as before this change

#### Scenario: Previously unguarded wcc knowledge action denies

- GIVEN a caller without a valid account role
- WHEN a WCC knowledge mutation action is invoked directly
- THEN the action MUST throw
- AND it MUST NOT mutate knowledge entries

#### Scenario: Previously unguarded settings update denies

- GIVEN a caller without a valid account role
- WHEN `updateSettingsAction` is invoked directly
- THEN the action MUST throw
- AND it MUST NOT update site settings

#### Scenario: Guarded actions still run for a valid agent

- GIVEN an authenticated account with role `agent`
- WHEN a guarded action is invoked with valid input
- THEN the action MUST run exactly as before this change

### Requirement: Sign-out remains callable without a role

`signOutAction` MUST remain available to any caller, including one whose session is expired or whose profile no longer carries a recognized role, so a user can always end their session. It MUST NOT be gated by a role check.

#### Scenario: Sign-out works without a valid role

- GIVEN a session whose account has no recognized role
- WHEN `signOutAction` is invoked
- THEN it MUST clear the session
- AND it MUST NOT be blocked by the authorization guard

## MODIFIED Requirements

### Requirement: Dashboard authentication

The system MUST protect `/dashboard/**` with Supabase authentication AND a valid account role (`admin` or `agent`) when Supabase environment variables are configured. Authentication alone is not sufficient; the account MUST carry a recognized role. The middleware that enforces this on route requests is a navigation gate: it MUST NOT be the only authorization for Server Actions, which MUST re-authorize inside the action (see Server Action authorization boundary). The middleware MUST resolve the role through the shared account-resolution path so its decision matches the application guards.

(Previously: described only the route-level middleware protection and did not require in-action re-authorization or a shared resolution path.)

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

#### Scenario: Server Action is authorized beyond the middleware gate

- GIVEN a request whose session and role pass the middleware gate
- WHEN it reaches a mutating dashboard Server Action
- THEN the action MUST still perform its own authorization check before touching data

### Requirement: Login and sign-out

The system MUST provide email/password login through Supabase and sign-out from dashboard settings/profile controls. Login and the middleware session refresh are the authentication boundary and MAY call `supabase.auth.getUser()` directly. Sign-out MUST NOT require a role check, so an account whose profile is missing or carries no recognized role can still end its session.

#### Scenario: Successful login

- GIVEN Supabase is configured and credentials are valid
- WHEN the user submits the login form
- THEN the system MUST create a session and redirect to `redirectTo` or `/dashboard`

#### Scenario: Supabase missing on login

- GIVEN Supabase is not configured
- WHEN the user submits the login form
- THEN the system MUST return to login with a configuration error

#### Scenario: Session without a role can still sign out

- GIVEN a session whose account has no recognized role
- WHEN the user signs out from dashboard controls
- THEN the system MUST end the session

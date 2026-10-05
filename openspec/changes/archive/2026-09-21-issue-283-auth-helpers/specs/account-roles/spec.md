# Delta for Account Roles

## ADDED Requirements

### Requirement: Canonical server-side authorization helpers

The system MUST expose one server-side authorization module, `src/lib/auth/roles.ts`, as the single entry point for resolving the current account and enforcing role/feature access in dashboard code. It MUST provide throw-style helpers for contexts that must not redirect — `requireRole(...allowed)`, `requireUser()`, and the non-throwing predicate `isCurrentUserAdmin()` — and redirect-style helpers for Server Components — `requireFeature(feature)` and `requireAdmin()`. Server Actions and Route Handlers MUST use the throw-style helpers; Server Components and pages MUST use the redirect-style helpers. No Server Action MAY rely on the path-based middleware gate as its authorization boundary.

#### Scenario: Server Action denies a caller with no valid role

- GIVEN a dashboard Server Action that mutates data
- WHEN it is invoked by a session whose account has no recognized role
- THEN the action MUST throw before performing any read or write

#### Scenario: Page keeps redirect-style enforcement

- GIVEN an agent without the `settings` feature
- WHEN the agent requests the settings page
- THEN the page MUST keep redirecting to `/dashboard`
- AND no exception MUST surface to the user

#### Scenario: Valid role passes the action guard

- GIVEN an authenticated account with role `admin` or `agent`
- WHEN a guarded dashboard Server Action is invoked
- THEN the action MUST proceed to its operation

### Requirement: Authenticated-user resolution

The system MUST provide `requireUser()` that resolves the Supabase Auth user for the current request and throws `Error("Unauthorized")` when there is no authenticated session. Server Actions and Route Handlers that need the caller identity MUST obtain it through this helper or `getCurrentAccount()` rather than calling `supabase.auth.getUser()` inline. Raw `auth.getUser()` calls outside the helper modules MUST be limited to the authentication boundary itself: the login flow and the middleware session refresh.

#### Scenario: requireUser returns the authenticated user

- GIVEN a valid Supabase session
- WHEN `requireUser()` is called
- THEN it MUST return the authenticated user

#### Scenario: requireUser throws without a session

- GIVEN no authenticated session
- WHEN `requireUser()` is called
- THEN it MUST throw `Error("Unauthorized")`

#### Scenario: No inline identity lookup in dashboard actions

- GIVEN any dashboard Server Action
- WHEN it needs the caller identity
- THEN it MUST resolve it through the authorization module
- AND it MUST NOT contain an inline `supabase.auth.getUser()` call

### Requirement: Non-throwing admin predicate

The system MUST expose `isCurrentUserAdmin()`, a non-throwing predicate that resolves the current account and returns a boolean indicating whether its role is `admin`. Server Actions that return discriminated-union results (`{ ok: false, error }`) MUST use this predicate instead of a throwing guard, so no try/catch is required. The accounts feature-toggle action MUST preserve its current user-visible behavior: a non-admin caller receives `{ ok: false, error: "No autorizado." }` and no data is written.

#### Scenario: Non-admin receives a typed error and no write

- GIVEN an authenticated account whose role is not `admin`
- WHEN the feature-toggle action is invoked
- THEN it MUST return `{ ok: false, error: "No autorizado." }`
- AND it MUST NOT persist any change

#### Scenario: Admin proceeds

- GIVEN an authenticated account whose role is `admin`
- WHEN the feature-toggle action is invoked with a valid feature set
- THEN it MUST persist the change and return `{ ok: true }`

#### Scenario: Predicate never throws on a missing account

- GIVEN no authenticated account can be resolved
- WHEN `isCurrentUserAdmin()` is called
- THEN it MUST return `false` without throwing

### Requirement: Single account-resolution path

The system MUST resolve the current account's role and features through one shared implementation used by both `getCurrentAccount()` and the dashboard middleware. Role normalization (`admin`/`agent`; any other value resolves to no role) and feature filtering MUST be identical on both paths so the middleware gate and the page/action guards cannot disagree. The middleware MAY keep its own Supabase client and cookie adapter, but MUST delegate profile resolution to the shared implementation. The shared implementation MUST NOT depend on `next/headers` or `next/navigation` so it stays usable from the middleware runtime.

#### Scenario: Unknown role is denied consistently

- GIVEN a profile row whose `role` is neither `admin` nor `agent`
- WHEN the middleware evaluates a `/dashboard/**` request
- THEN it MUST treat the account as having no role and deny the navigation
- AND the application guards MUST resolve that same account as having no role

#### Scenario: Recognized role is accepted consistently

- GIVEN a profile row with role `agent`
- WHEN both the middleware and the application guards resolve the account
- THEN both MUST resolve role `agent`

#### Scenario: Unknown persisted features are filtered identically

- GIVEN a profile row whose `features` array contains a value not in the feature catalog
- WHEN the account is resolved by the middleware path and by the application guard path
- THEN both MUST drop the unknown value and keep only recognized features

## MODIFIED Requirements

### Requirement: Dashboard role enforcement

The system MUST deny dashboard access to any authenticated user who does not have a valid role (`admin` or `agent`). A valid role is necessary in addition to a valid authentication session. Enforcement MUST be applied both when a dashboard route is requested and inside each mutating dashboard Server Action, because the middleware path gate only covers route requests and does not evaluate feature access.

(Previously: described only route-level denial via the middleware and did not require in-action enforcement.)

#### Scenario: Authenticated user with no role denied

- GIVEN an authenticated session exists but the account has no valid role
- WHEN the user requests a `/dashboard/**` route
- THEN the system MUST redirect the user away from the dashboard

#### Scenario: Agent reaches dashboard

- GIVEN an authenticated account with role `agent`
- WHEN the user requests a `/dashboard/**` route
- THEN the dashboard route MUST be allowed to render

#### Scenario: Mutating action re-checks the role

- GIVEN a session without a valid role reaches a mutating dashboard Server Action
- WHEN the action runs
- THEN it MUST deny the operation instead of performing it

#### Scenario: Feature enforcement remains at the route layer

- GIVEN an agent without a feature assigned
- WHEN the agent requests that feature's page
- THEN the system MUST keep redirecting as before
- AND this change MUST NOT alter that page behavior

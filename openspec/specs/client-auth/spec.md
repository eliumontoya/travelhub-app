# Client Authentication Specification

## Purpose

Provide email + PIN login for clients, issuing a signed `HttpOnly` session cookie, with server-side verify/logout helpers and per-email rate limiting. Published trip and client-history pages remain unauthenticated.

## Requirements

### Requirement: Client login

The system MUST expose `/client/login` accepting email and PIN. On valid credentials it MUST issue a signed `HttpOnly` session cookie. On invalid credentials it MUST NOT issue a cookie and MUST return a generic authentication error. On successful authentication the client MUST be redirected to `/client`.

#### Scenario: Successful login

- GIVEN a registered client with a known PIN
- WHEN correct email and PIN are submitted
- THEN a signed `HttpOnly` session cookie MUST be set
- AND the client is redirected to `/client`

#### Scenario: Invalid credentials

- GIVEN a submitted email/PIN pair that is unknown, wrong, or for a client with no PIN
- WHEN the login form is submitted
- THEN a generic "invalid credentials" error MUST be returned
- AND no session cookie MUST be set

#### Scenario: Rate-limited login

- GIVEN an email has exceeded the allowed failed attempts within the window
- WHEN another login attempt is made for that email
- THEN a "too many attempts" error MUST be returned

### Requirement: Session cookie properties

The session cookie MUST carry the `HttpOnly` flag, be signed with a server secret, and expire after a server-defined lifetime.

#### Scenario: Cookie hidden from JavaScript

- GIVEN a session cookie has been issued
- WHEN `document.cookie` is read
- THEN the session cookie MUST NOT be present

#### Scenario: Tampered or expired cookie

- GIVEN a session cookie that has been modified or has exceeded its lifetime
- WHEN presented to the verify helper
- THEN it MUST be treated as invalid

### Requirement: Session verify

The system MUST expose a server-side verify helper that reads the session cookie and returns the authenticated client identity when valid, or a "no session" result when absent or invalid, without raising.

#### Scenario: Valid session

- GIVEN a request with a valid, unexpired session cookie
- WHEN verify is invoked
- THEN the matching client identity MUST be returned

#### Scenario: Missing or invalid cookie

- GIVEN a request with no cookie, or a tampered/expired cookie
- WHEN verify is invoked
- THEN a "no session" result MUST be returned without raising

### Requirement: Logout

The system MUST expose a logout action that destroys the session cookie so subsequent requests are unauthenticated.

#### Scenario: Logout clears session

- GIVEN an authenticated client with a valid session cookie
- WHEN logout is invoked
- THEN the cookie MUST be cleared
- AND subsequent requests MUST have no active session

### Requirement: Per-email rate limiting

The system MUST limit consecutive failed login attempts per email within a sliding window. After the threshold, further attempts MUST be rejected until the window elapses. Successful login MUST reset the counter.

#### Scenario: Threshold triggers lockout

- GIVEN the threshold is N failures within W minutes
- WHEN N+1 consecutive failures occur for the same email within W minutes
- THEN the next attempt for that email MUST be rejected

#### Scenario: Success resets counter

- GIVEN an email with prior failures below the threshold
- WHEN a subsequent login succeeds
- THEN the failure counter for that email MUST reset to zero

#### Scenario: Other emails unaffected

- GIVEN email A is rate-limited
- WHEN a login attempt is made for email B
- THEN email B MUST be evaluated independently
### Requirement: PIN session required for traveler mutations

Traveler activity writes MUST require a valid, unexpired PIN session and assignment to the target trip. This MUST NOT be required for anonymous published-trip viewing.

#### Scenario: Assigned authenticated traveler may mutate

- GIVEN a client has a valid PIN session and a private assignment to a published trip
- WHEN the client submits an allowed activity mutation
- THEN the mutation MAY proceed subject to day and ownership checks

#### Scenario: Missing or invalid session is rejected

- GIVEN a client has no session or presents a tampered or expired session
- WHEN the client submits an activity mutation
- THEN the mutation MUST be rejected without persistence

#### Scenario: Viewing remains unauthenticated

- GIVEN a trip is published
- WHEN an anonymous user opens `/t/{slug}`
- THEN the itinerary MUST render without a client session

# Delta for Client Authentication

## MODIFIED Requirements

### Requirement: Client login

The system MUST expose `/client/login` accepting email and PIN. On valid credentials it MUST issue a signed `HttpOnly` session cookie. On invalid credentials it MUST NOT issue a cookie and MUST return a generic authentication error. On successful authentication the client MUST be redirected to `/client`.

**Clarification:** Traveler entry points that would normally send an unauthenticated traveler to `/client/login` MUST avoid showing the login page when a valid client session already exists. In that case, the traveler MUST be routed to `/client`.

#### Scenario: Successful login

- GIVEN a registered client with a known PIN
- WHEN correct email and PIN are submitted
- THEN a signed `HttpOnly` session cookie MUST be set
- AND the client is redirected to `/client`

#### Scenario: Authenticated traveler avoids login page

- GIVEN a traveler has a valid client session cookie
- WHEN a traveler entry point attempts to send them to client login
- THEN the system MUST route them to `/client` instead
- AND it MUST NOT require them to submit email and PIN again

#### Scenario: Anonymous traveler still reaches login

- GIVEN a traveler has no valid client session cookie
- WHEN a traveler entry point requires authentication
- THEN the system MAY route them to `/client/login`

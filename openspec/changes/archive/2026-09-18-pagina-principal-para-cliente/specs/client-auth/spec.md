# Client Authentication — Delta Specification

> **Change:** `pagina-principal-para-cliente`
> **Baseline:** `openspec/specs/client-auth/spec.md`
> **Delta type:** MODIFIED Requirements

## MODIFIED Requirements

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

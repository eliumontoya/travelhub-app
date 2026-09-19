# Client Home — Delta Specification

> **Change:** `pagina-principal-para-cliente`
> **Baseline:** No prior `client-home` capability exists. All requirements below are ADDED.

## ADDED Requirements

### Requirement: Authenticated client home page

The system SHALL expose a client home page at `/client`. An authenticated client visiting this route SHALL see their read-only profile. The client MUST NOT be able to edit any profile field. The profile SHALL include the following fields: `name`, `email`, `phone`, `whatsapp`, `birthDate`, `notes`, `referralSource`, and `coverImageUrl`.

#### Scenario: Authenticated client sees read-only profile

- GIVEN an authenticated client with a valid session
- WHEN the client navigates to `/client`
- THEN the page SHALL display the client's `name`, `email`, `phone`, `whatsapp`, `birthDate`, `notes`, `referralSource`, and `coverImageUrl`
- AND no field SHALL be editable by the client

#### Scenario: Profile fields are not editable

- GIVEN an authenticated client viewing their home page
- WHEN the client inspects the rendered profile
- THEN there MUST NOT be any input, button, or action that allows modifying profile data

---

### Requirement: Unauthenticated redirect to login

An unauthenticated visitor accessing `/client` SHALL be redirected to `/client/login`.

#### Scenario: Unauthenticated visitor redirected

- GIVEN a visitor with no valid client session
- WHEN the visitor requests `/client`
- THEN the visitor SHALL be redirected to `/client/login`

---

### Requirement: Client trip list

The system SHALL display the trips associated with the authenticated client via the `trip_clients` relationship. Only trips with a status of `draft` or `published` SHALL be shown. Trips with a status of `archived` SHALL NOT appear in the list.

#### Scenario: Client sees draft and published trips

- GIVEN an authenticated client with two trips: one `draft` and one `published`
- WHEN the client views `/client`
- THEN both trips SHALL appear in the trip list

#### Scenario: Archived trips are hidden

- GIVEN an authenticated client with one `published` trip and one `archived` trip
- WHEN the client views `/client`
- THEN only the `published` trip SHALL appear in the list
- AND the `archived` trip SHALL NOT be visible

---

### Requirement: Public link for published trips only

ONLY trips with a status of `published` SHALL render a navigable link to `/t/{slug}`. Trips with a status of `draft` SHALL display their status but MUST NOT render a link.

#### Scenario: Published trip shows link

- GIVEN an authenticated client with a `published` trip having slug `patagonia-2026`
- WHEN the client views `/client`
- THEN the trip SHALL render a link to `/t/patagonia-2026`

#### Scenario: Draft trip shows status without link

- GIVEN an authenticated client with a `draft` trip
- WHEN the client views `/client`
- THEN the trip SHALL display its `draft` status
- AND the trip MUST NOT render a link to `/t/{slug}`

---

### Requirement: Agent-only fields excluded from client view

The client SHALL see `salePrice` and their assigned agent for each trip. The client MUST NOT see `commissionRate` or `internalNotes` anywhere in the page response or rendered UI.

#### Scenario: Client sees salePrice and agent

- GIVEN an authenticated client with a trip that has `salePrice`, `commissionRate`, `internalNotes`, and an assigned agent
- WHEN the client views `/client`
- THEN `salePrice` SHALL be visible for that trip
- AND the assigned agent SHALL be visible for that trip

#### Scenario: Commission rate is hidden

- GIVEN an authenticated client with a trip that has a `commissionRate` value
- WHEN the client views `/client`
- THEN `commissionRate` MUST NOT appear in the page response or rendered UI

#### Scenario: Internal notes are hidden

- GIVEN an authenticated client with a trip that has `internalNotes`
- WHEN the client views `/client`
- THEN `internalNotes` MUST NOT appear in the page response or rendered UI

---

### Requirement: Client logout

The client SHALL be able to log out from the home page. The logout action SHALL destroy the client session and redirect the client to `/client/login`.

#### Scenario: Logout destroys session and redirects

- GIVEN an authenticated client on `/client`
- WHEN the client triggers the logout action
- THEN the session SHALL be destroyed
- AND the client SHALL be redirected to `/client/login`

#### Scenario: Post-logout requests are unauthenticated

- GIVEN a client who has logged out
- WHEN the client subsequently requests `/client`
- THEN the client SHALL be redirected to `/client/login`

---

### Requirement: Graceful degradation when Supabase is unconfigured

When Supabase is unconfigured (mock mode) or `SUPABASE_SERVICE_ROLE_KEY` is missing, the client home page SHALL degrade gracefully according to the project's external-integration degradation rule. The page MUST NOT crash or render an unhandled error.

#### Scenario: Mock mode renders gracefully

- GIVEN Supabase is unconfigured and the application is running in mock mode
- WHEN an authenticated client navigates to `/client`
- THEN the page SHALL render without crashing
- AND the page SHALL display data from the mock data source or a graceful fallback

#### Scenario: Missing service role key degrades gracefully

- GIVEN `SUPABASE_SERVICE_ROLE_KEY` is not set
- WHEN an authenticated client navigates to `/client`
- THEN the page SHALL NOT throw an unhandled error
- AND the page SHALL degrade gracefully per the project's external-integration rule

---

### Requirement: Data isolation — client sees only own data

A client SHALL only see their own profile and their own trips. No cross-client data SHALL be accessible through the client home page.

#### Scenario: Client sees only own profile

- GIVEN two authenticated clients, A and B, each with distinct profile data
- WHEN client A views `/client`
- THEN only client A's profile data SHALL be displayed
- AND client B's data SHALL NOT be accessible

#### Scenario: Client sees only own trips

- GIVEN client A with one trip and client B with a different trip
- WHEN client A views `/client`
- THEN only client A's trip SHALL appear in the list
- AND client B's trip SHALL NOT appear

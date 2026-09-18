# Client CRM — Delta Specification

This delta extends the main `client-crm` spec with PIN management for authentication. Existing requirements are unchanged unless explicitly listed under MODIFIED.

## ADDED Requirements

### Requirement: Client PIN storage

The system MUST store an optional authentication PIN per client as a hashed value in a nullable `pin_hash` column. The plaintext PIN MUST NEVER be persisted, returned by the data layer, or written to logs.

#### Scenario: New client has no PIN

- GIVEN a newly created client
- WHEN the client is loaded
- THEN `pin_hash` MUST be `null`

#### Scenario: PIN is stored as a hash

- GIVEN the agent sets a PIN for a client
- WHEN the client row is read from storage
- THEN `pin_hash` MUST contain a non-plaintext hashed value
- AND the original PIN MUST NOT be recoverable from `pin_hash`

#### Scenario: PIN is never exposed in API responses

- GIVEN a client with a stored PIN hash
- WHEN the client is returned through the data layer
- THEN the response MUST NOT include the plaintext PIN or the `pin_hash` value

### Requirement: Agent sets or rotates client PIN

The agent MUST be able to set a PIN for a client who has none, and rotate (replace) the PIN for a client who already has one, through the client form. The system MUST accept the new PIN, hash it, and persist the result in `pin_hash`.

#### Scenario: Agent sets initial PIN

- GIVEN a client with `pin_hash` equal to `null`
- WHEN the agent submits the client form with a new PIN
- THEN `pin_hash` MUST be updated to the hash of the submitted PIN
- AND subsequent login attempts with that PIN MUST succeed

#### Scenario: Agent rotates existing PIN

- GIVEN a client with a previously set `pin_hash`
- WHEN the agent submits the client form with a new PIN
- THEN `pin_hash` MUST be replaced with the hash of the new PIN
- AND the previous PIN MUST no longer authenticate

#### Scenario: Client without PIN cannot log in

- GIVEN a client with `pin_hash` equal to `null`
- WHEN a login attempt is made with that client's email and any PIN
- THEN the login MUST fail
- AND no session cookie MUST be issued

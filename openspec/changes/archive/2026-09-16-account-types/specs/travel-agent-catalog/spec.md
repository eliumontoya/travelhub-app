# Delta for Travel Agent Catalog

## ADDED Requirements

### Requirement: Agent account to catalog mapping

The system MUST support associating an `agent` account with exactly one `travel_agents` record. The mapping MUST be resolvable from the account to the catalog entry and vice versa. An agent account MAY exist without a catalog link. Deleting a linked `travel_agents` record MUST NOT delete the account; it MUST nullify the mapping.

#### Scenario: Link agent account to catalog entry

- GIVEN an agent account and a `travel_agents` record exist
- WHEN the system creates the mapping between them
- THEN queries for the account's catalog identity MUST return the linked `travel_agents` record

#### Scenario: Query catalog entry by account

- GIVEN an agent account is linked to `travel_agents` record `A1`
- WHEN the system resolves the catalog entry from the account
- THEN the result MUST be the `travel_agents` record with id `A1`

#### Scenario: Agent account without catalog link

- GIVEN an agent account with no `travel_agents` mapping
- WHEN the system resolves the catalog identity
- THEN the result MUST be null and the account MUST remain valid

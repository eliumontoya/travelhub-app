# Travel Agent Catalog Specification

## Purpose

Maintain reusable travel-agent records and support the nullable assignment of a single agent to a trip.

## Requirements

### Requirement: Travel agent CRUD

The system MUST let the authenticated agent create, list, update, and delete travel agents with at minimum a name and optional contact fields (email, phone, notes). Listing MUST return all active agents.

#### Scenario: Create agent

- GIVEN the agent opens the travel-agent catalog
- WHEN they submit a record with a name
- THEN the agent MUST appear in the active list

#### Scenario: Update agent

- GIVEN an existing travel agent
- WHEN the agent edits its name or contact fields
- THEN the updated values MUST be persisted

#### Scenario: Delete agent with no trips assigned

- GIVEN a travel agent is not assigned to any trip
- WHEN the agent deletes it
- THEN the record MUST be removed from the catalog

#### Scenario: Delete agent referenced by trips

- GIVEN a travel agent is assigned to one or more trips
- WHEN the agent deletes it
- THEN the system MUST nullify `assigned_agent_id` on those trips and remove the agent record

### Requirement: Travel agent trip assignment

The system MUST support a nullable single-agent assignment per trip via `assigned_agent_id`. A trip MAY have zero or one assigned agent. Setting `assigned_agent_id` to null removes the assignment.

#### Scenario: Assign agent to trip

- GIVEN a trip exists and a travel agent exists
- WHEN the agent assigns the agent to the trip
- THEN `assigned_agent_id` on the trip MUST equal that agent's id

#### Scenario: Trip with no assigned agent

- GIVEN a trip has no assigned agent
- WHEN the trip is loaded
- THEN `assigned_agent_id` MUST be null and the trip MUST remain valid

#### Scenario: Change assigned agent

- GIVEN a trip has agent A assigned
- WHEN the agent reassigns it to agent B
- THEN `assigned_agent_id` MUST equal B's id

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

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

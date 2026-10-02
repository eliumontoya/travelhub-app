# Visa Management Specification

## Purpose

Provide agents with the ability to manage visa applications as a top-level service: create, list, view, and edit visa applications; assign and unassign one or more clients per visa; and drive each visa through the minimal `pending → in_progress → completed` status lifecycle with an append-only status history. This domain is separate from `trips` and does not reuse the trip schema, status vocabulary, or public trip view.

## Requirements

### Requirement: Create visa application

The system MUST allow an authenticated agent to create a visa application by providing at least `country`, `visa_type`, `deadline`, and `price`. The system MUST reject creation when any of these four fields is missing. The system MAY accept additional optional fields and MUST persist them when provided. On creation, the visa's initial status MUST be `pending`.

#### Scenario: Agent creates a visa with all required fields

- GIVEN an authenticated agent and a valid `country`, `visa_type`, `deadline`, and `price`
- WHEN the agent submits the create-visa request
- THEN the system MUST persist a new visa application with status `pending`
- AND the system MUST return the created visa including its generated identifier.

#### Scenario: Creation rejected when required field is missing

- GIVEN an authenticated agent
- WHEN the agent submits a create-visa request missing `deadline`
- THEN the system MUST reject the request
- AND no visa application MUST be persisted.

#### Scenario: Creation rejected for unauthenticated caller

- GIVEN no authenticated agent
- WHEN a create-visa request is submitted
- THEN the system MUST reject the request.

### Requirement: List visa applications

The system MUST allow an authenticated agent to list visa applications visible to that agent. The list MUST support filtering by status, client, and country, and MUST support pagination. The list response MUST include each visa's current status and the set of assigned clients.

#### Scenario: Agent lists all visas

- GIVEN an authenticated agent with the `visas` feature enabled and at least one visa exists
- WHEN the agent opens the visa list view
- THEN the system MUST return every visa the agent can see with its current status and assigned clients.

#### Scenario: Agent filters by status

- GIVEN an authenticated agent and visas in `pending`, `in_progress`, and `completed` statuses
- WHEN the agent filters the list by status `in_progress`
- THEN the returned list MUST contain only visas whose current status is `in_progress`.

#### Scenario: Agent filters by client

- GIVEN an authenticated agent and a visa assigned to client `C1`
- WHEN the agent filters the list by client `C1`
- THEN the returned list MUST include that visa
- AND MUST NOT include visas not assigned to `C1`.

#### Scenario: Agent filters by country

- GIVEN an authenticated agent and visas for countries `France` and `Japan`
- WHEN the agent filters the list by country `France`
- THEN the returned list MUST include only visas whose `country` is `France`.

#### Scenario: Empty result when no visas match

- GIVEN an authenticated agent and no visas matching the active filters
- WHEN the agent requests the list
- THEN the system MUST return an empty list without error.

### Requirement: View visa details

The system MUST allow an authenticated agent to view the full details of a single visa application, including its required fields (`country`, `visa_type`, `deadline`, `price`), current status, assigned clients, and the full append-only status history.

#### Scenario: Agent views an existing visa

- GIVEN an authenticated agent and an existing visa with two status history entries
- WHEN the agent opens the visa detail view
- THEN the system MUST return the visa's required fields, current status, assigned clients, and the two status history entries in chronological order.

#### Scenario: Viewing a non-existent visa

- GIVEN an authenticated agent
- WHEN the agent requests details for a visa identifier that does not exist
- THEN the system MUST return a not-found response.

### Requirement: Edit visa application

The system MUST allow an authenticated agent to edit a visa application's mutable fields, including `country`, `visa_type`, `deadline`, `price`, and any additional optional fields. Editing a visa MUST NOT alter its status; status changes are performed through the dedicated status-transition operation.

#### Scenario: Agent updates deadline

- GIVEN an authenticated agent and an existing visa with `deadline` `2026-10-01`
- WHEN the agent updates the visa's `deadline` to `2026-11-15`
- THEN the visa's `deadline` MUST be `2026-11-15`
- AND the visa's status MUST remain unchanged.

#### Scenario: Edit preserves assigned clients

- GIVEN an existing visa assigned to clients `C1` and `C2`
- WHEN the agent edits the visa's `visa_type`
- THEN the visa MUST remain assigned to `C1` and `C2`.

### Requirement: Assign clients to a visa

The system MUST allow an authenticated agent to assign one or more clients to a visa application. Assigning clients MUST be an idempotent set operation: the resulting assignment MUST equal the union of the previously assigned clients and the newly added clients, with no duplicates.

#### Scenario: Agent assigns a new client

- GIVEN a visa currently assigned to client `C1`
- WHEN the agent assigns client `C2` to the same visa
- THEN the visa MUST be assigned to both `C1` and `C2`.

#### Scenario: Assigning an already-assigned client is idempotent

- GIVEN a visa assigned to client `C1`
- WHEN the agent assigns `C1` again
- THEN the visa MUST remain assigned to `C1` only once.

#### Scenario: Assigning multiple clients at once

- GIVEN a visa with no assigned clients
- WHEN the agent assigns clients `C1`, `C2`, and `C3` in a single operation
- THEN the visa MUST be assigned to all three clients.

### Requirement: Unassign clients from a visa

The system MUST allow an authenticated agent to remove one or more clients from a visa application. Unassigning MUST be an idempotent set-difference operation: removing a client that is not assigned MUST be a no-op.

#### Scenario: Agent unassigns a client

- GIVEN a visa assigned to `C1` and `C2`
- WHEN the agent unassigns `C1`
- THEN the visa MUST be assigned to `C2` only.

#### Scenario: Unassigning a non-assigned client is a no-op

- GIVEN a visa assigned to `C1`
- WHEN the agent unassigns `C2`
- THEN the visa MUST remain assigned to `C1` only, with no error.

#### Scenario: Unassigning all clients leaves visa with no assignments

- GIVEN a visa assigned to `C1`
- WHEN the agent unassigns `C1`
- THEN the visa MUST have no assigned clients.

### Requirement: Status lifecycle transitions

The system MUST enforce the minimal visa status lifecycle `pending → in_progress → completed`. The system MUST allow transitions only along this forward chain; backward or skip transitions MUST be rejected. Each successful transition MUST append a new entry to the visa's status history with the new status and a timestamp.

#### Scenario: Transition from pending to in_progress

- GIVEN a visa with status `pending`
- WHEN the agent transitions the visa to `in_progress`
- THEN the visa's status MUST become `in_progress`
- AND a new status history entry with status `in_progress` and the current timestamp MUST be appended.

#### Scenario: Transition from in_progress to completed

- GIVEN a visa with status `in_progress`
- WHEN the agent transitions the visa to `completed`
- THEN the visa's status MUST become `completed`
- AND a new status history entry with status `completed` MUST be appended.

#### Scenario: Backward transition rejected

- GIVEN a visa with status `in_progress`
- WHEN the agent attempts to transition the visa to `pending`
- THEN the system MUST reject the transition
- AND the visa's status MUST remain `in_progress`
- AND no status history entry MUST be appended.

#### Scenario: Skip transition rejected

- GIVEN a visa with status `pending`
- WHEN the agent attempts to transition the visa directly to `completed`
- THEN the system MUST reject the transition
- AND the visa's status MUST remain `pending`.

#### Scenario: Transition on already-completed visa rejected

- GIVEN a visa with status `completed`
- WHEN the agent attempts any status transition
- THEN the system MUST reject the transition.

### Requirement: Append-only status history

The visa status history MUST be append-only. Once a status history entry is persisted, the system MUST NOT allow it to be modified or deleted through any visa-management operation. The history MUST be ordered chronologically by entry timestamp.

#### Scenario: History entries cannot be modified

- GIVEN a visa with three status history entries
- WHEN any visa-management operation is performed on the visa
- THEN the three existing history entries MUST remain unchanged in content and order.

#### Scenario: New transition appends to history

- GIVEN a visa with two status history entries and current status `in_progress`
- WHEN the agent transitions the visa to `completed`
- THEN the visa's status history MUST contain three entries in chronological order, with the third entry having status `completed`.

### Requirement: Dual-mode behavior parity

All visa-management operations MUST behave identically in Supabase mode and in mock mode. In mock mode, every mutation MUST update the in-memory mock state so that subsequent reads reflect the change, mirroring the Supabase write.

#### Scenario: Mock create is readable

- GIVEN Supabase is not configured
- WHEN an agent creates a visa
- THEN a subsequent list or detail read MUST return the created visa with its assigned clients and status.

#### Scenario: Mock status transition is reflected in history

- GIVEN Supabase is not configured and a visa with status `pending`
- WHEN the agent transitions the visa to `in_progress`
- THEN a subsequent detail read MUST show status `in_progress` and a status history with two entries.

#### Scenario: Supabase and mock produce equivalent results

- GIVEN the same sequence of visa operations applied in Supabase mode and in mock mode
- WHEN the visa is read in both modes
- THEN the returned visa, its assigned clients, and its status history MUST be equivalent.

### Requirement: Feature gating

The visa-management surface MUST be accessible only to agents whose profile includes the `visas` feature. Agents without the `visas` feature MUST NOT be able to list, create, view, edit, or transition visas.

#### Scenario: Agent with visas feature accesses visa list

- GIVEN an authenticated agent whose profile includes the `visas` feature
- WHEN the agent opens the visa list view
- THEN the system MUST return the visa list.

#### Scenario: Agent without visas feature denied

- GIVEN an authenticated agent whose profile does not include the `visas` feature
- WHEN the agent attempts to access the visa list view
- THEN the system MUST deny access.

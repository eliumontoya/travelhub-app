# Delta Spec: issue-185-delete-clients

## Requirement: Delete client with confirmation

The system MUST let the authenticated agent delete a client from the clients console only after confirming the deletion intent.

### Scenario: Delete after exact-name confirmation

- GIVEN a client exists in the authenticated clients console
- WHEN the agent initiates deletion and confirms with the client's current exact name
- THEN the client MUST be removed from the clients list
- AND the system MUST refresh the affected dashboard views

### Scenario: Reject missing or incorrect confirmation

- GIVEN a client exists in the authenticated clients console
- WHEN a delete request is submitted without confirmation or with a different name
- THEN the client MUST remain stored
- AND the delete action MUST NOT remove related records

### Scenario: Preserve trips while removing client relationships

- GIVEN a client is assigned to one or more trips
- WHEN the client is deleted after valid confirmation
- THEN the system MUST remove the deleted client's assignment/tag/document relationships according to the schema
- AND the system MUST NOT delete the trips themselves

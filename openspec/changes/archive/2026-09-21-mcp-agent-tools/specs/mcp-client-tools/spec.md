# MCP Client Tools Specification

## Purpose

Expose TravelHub's client domain to an external agent through the MCP server. The tools let an agent list, read, create, and update clients, read and replace a client's tags, and fetch a client's trips together with a compact summary.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any client tool from executing when the service role is absent, so no client tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any client tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Client tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: <resource> <id>` with `isError: true`, where `<resource>` is a user-readable label and `<id>` is the caller-supplied identifier. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN a `get_client` call for a client id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: client <id>` where `<id>` is the caller-supplied id

#### Scenario: Unexpected error is sanitized

- GIVEN a client tool invocation that fails for an unexpected reason
- WHEN the server returns the error result
- THEN the result contains a sanitized message
- AND no stack trace or credential is exposed

### Requirement: List clients

The `list_clients` tool MUST return clients in a paginated result, respecting optional `page` and `pageSize` arguments, and each returned client MUST include its identifier.

#### Scenario: List clients

- GIVEN one or more clients exist
- WHEN the agent calls `list_clients`
- THEN the result contains the clients
- AND each client includes its id

#### Scenario: Paginated list

- GIVEN more clients than the requested `pageSize`
- WHEN the agent calls `list_clients` with `page` and `pageSize`
- THEN the result returns the slice of clients for that page
- AND the total count of clients is exposed

### Requirement: Get a client

The `get_client` tool MUST return the client matching the caller-supplied id, or a `NOT_FOUND: client <id>` error result when no such client exists.

#### Scenario: Get an existing client

- GIVEN a client with a known id
- WHEN the agent calls `get_client` with that id
- THEN the result contains that client's fields

#### Scenario: Get a missing client

- GIVEN no client with the caller-supplied id
- WHEN the agent calls `get_client` with that id
- THEN the result is `NOT_FOUND: client <id>` with `isError: true`

### Requirement: Create a client

The `create_client` tool MUST create a client from a required `name` and the optional contact/profile fields (`email`, `phone`, `notes`, `referralSource`, `birthDate`, `coverImageUrl`), and MUST return the created client including its id.

#### Scenario: Create a client

- GIVEN the agent supplies a `name`
- WHEN the agent calls `create_client`
- THEN a client is created and the result contains the new client with its id

#### Scenario: Reject missing name

- GIVEN the agent omits `name`
- WHEN the agent calls `create_client`
- THEN the call is rejected at schema validation
- AND no client is created

### Requirement: Update a client

The `update_client` tool MUST update an existing client from the caller-supplied partial fields, returning the updated client. When the client does not exist, the tool MUST return `NOT_FOUND: client <id>`.

#### Scenario: Update an existing client

- GIVEN a client with a known id
- WHEN the agent calls `update_client` with that id and changed fields
- THEN the client is updated and the result contains the updated client

#### Scenario: Update a missing client

- GIVEN no client with the caller-supplied id
- WHEN the agent calls `update_client` with that id
- THEN the result is `NOT_FOUND: client <id>` with `isError: true`

### Requirement: Get client tags

The `get_client_tags` tool MUST return the tags assigned to the caller-supplied client, as an empty list when the client has no tags.

#### Scenario: Get tags

- GIVEN a client with assigned tags
- WHEN the agent calls `get_client_tags` with the client's id
- THEN the result contains the client's tags

#### Scenario: Client with no tags

- GIVEN a client with no assigned tags
- WHEN the agent calls `get_client_tags` with the client's id
- THEN the result is an empty list

### Requirement: Set client tags

The `set_client_tags` tool MUST replace the full set of tags assigned to the caller-supplied client with the supplied `tagIds`. Supplying an empty `tagIds` array MUST clear all tags without error.

#### Scenario: Replace tags

- GIVEN a client with an existing set of tags
- WHEN the agent calls `set_client_tags` with a new `tagIds` list
- THEN the client's tags are replaced with exactly the supplied ids

#### Scenario: Clear all tags

- GIVEN a client with assigned tags
- WHEN the agent calls `set_client_tags` with an empty `tagIds` array
- THEN the client ends with no assigned tags
- AND the call succeeds

### Requirement: Get client trips and summary

The `get_client_trips` tool MUST return the trips assigned to the caller-supplied client together with a summary exposing `totalTrips`, `publishedCount`, `draftCount`, and `archivedCount`.

#### Scenario: Get trips and summary

- GIVEN a client with assigned trips in various statuses
- WHEN the agent calls `get_client_trips` with the client's id
- THEN the result contains the client's trips
- AND the summary counts reflect the trips' statuses

#### Scenario: Client with no trips

- GIVEN a client with no assigned trips
- WHEN the agent calls `get_client_trips` with the client's id
- THEN the trips list is empty
- AND the summary reports `totalTrips` of 0

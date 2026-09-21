# MCP Trip Tools Specification

## Purpose

Expose TravelHub's trip domain to an external agent through the MCP server. The tools let an agent list, read, create, and update trips, create trips from templates, replace a trip's clients and tags, save a trip as a template, and list templates.

## Requirements

### Requirement: Direct data-layer access under the service-role gate

Each tool MUST invoke the TravelHub data layer directly and MUST NOT pass an injected Supabase client or rely on any request-scoped client store. The MCP route's service-role gate MUST prevent any trip tool from executing when the service role is absent, so no trip tool MUST operate against in-memory mock data.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN the agent invokes any trip tool
- THEN the request is rejected with HTTP 503 before the tool executes
- AND no mock-data read or mutation occurs

### Requirement: Structured success/error envelope

Trip tool results MUST use a structured success/error envelope. Successful object payloads MUST be returned as a JSON-encoded text content block. Not-found failures MUST surface `NOT_FOUND: <resource> <id>` with `isError: true`, where `<resource>` is a user-readable label such as `trip` or `template` and `<id>` is the caller-supplied identifier. Unexpected failures MUST return a sanitized message and MUST NOT expose stack traces, database identifiers, or service-role credentials.

#### Scenario: Not-found result names the resource and id

- GIVEN a `get_trip` call for a trip id that does not exist
- WHEN the server returns the result
- THEN the result has `isError: true`
- AND the message is `NOT_FOUND: trip <id>` where `<id>` is the caller-supplied id

### Requirement: List trips

The `list_trips` tool MUST return trips with their clients in a paginated result respecting optional `page` and `pageSize`, applying the optional `filters` (query, statuses, currency, clientIds, tagIds, date range), and each returned trip MUST include its identifier.

#### Scenario: List trips

- GIVEN one or more trips exist
- WHEN the agent calls `list_trips`
- THEN the result contains the trips
- AND each trip includes its id and clients

#### Scenario: Filtered list

- GIVEN trips in mixed statuses
- WHEN the agent calls `list_trips` with a `status` filter
- THEN the result contains only trips matching that filter

### Requirement: Get a trip

The `get_trip` tool MUST return the trip (with its details) matching the caller-supplied id, or a `NOT_FOUND: trip <id>` error result when no such trip exists.

#### Scenario: Get an existing trip

- GIVEN a trip with a known id
- WHEN the agent calls `get_trip` with that id
- THEN the result contains that trip's details

#### Scenario: Get a missing trip

- GIVEN no trip with the caller-supplied id
- WHEN the agent calls `get_trip` with that id
- THEN the result is `NOT_FOUND: trip <id>` with `isError: true`

### Requirement: Create a trip

The `create_trip` tool MUST create a trip from a required `title` and a required `clientIds` array with at least one entry. The tool MUST ensure the persisted trip has a non-empty slug: when the caller omits `slug`, the tool MUST derive one from the title (falling back to a stable default) plus a uniqueness suffix. The tool MUST return the created trip including its id and slug.

#### Scenario: Create a trip

- GIVEN the agent supplies a `title` and at least one `clientId`
- WHEN the agent calls `create_trip`
- THEN a trip is created and the result contains the new trip with its id and slug

#### Scenario: Slug auto-generated

- GIVEN the agent supplies a `title` and omits `slug`
- WHEN the agent calls `create_trip`
- THEN the created trip has a non-empty slug derived from the title

#### Scenario: Reject empty clientIds

- GIVEN the agent supplies a `title` and an empty `clientIds` array
- WHEN the agent calls `create_trip`
- THEN the call is rejected at schema validation
- AND no trip is created

### Requirement: Create a trip from a template

The `create_trip_from_template` tool MUST create a new trip from an existing template, copying the template's day/item structure into the new trip. The tool MUST require a `title` and a `clientIds` array with at least one entry, MUST ensure the persisted trip has a non-empty slug, and MUST return the created trip. When the template does not exist, the tool MUST return `NOT_FOUND: template <id>`.

#### Scenario: Create from a template

- GIVEN an existing template and the agent supplies a `title` and at least one `clientId`
- WHEN the agent calls `create_trip_from_template` with the template's id
- THEN a new trip is created with the template's day/item structure
- AND the result contains the new trip with its id and slug

#### Scenario: Reject empty clientIds

- GIVEN an existing template
- WHEN the agent calls `create_trip_from_template` with an empty `clientIds` array
- THEN the call is rejected at schema validation
- AND no trip is created

#### Scenario: Missing template

- GIVEN no template with the caller-supplied id
- WHEN the agent calls `create_trip_from_template` with that id
- THEN the result is `NOT_FOUND: template <id>` with `isError: true`

### Requirement: Update a trip

The `update_trip` tool MUST update an existing trip from the caller-supplied partial fields, returning the updated trip. When the trip does not exist, the tool MUST return `NOT_FOUND: trip <id>`.

#### Scenario: Update an existing trip

- GIVEN a trip with a known id
- WHEN the agent calls `update_trip` with that id and changed fields
- THEN the trip is updated and the result contains the updated trip

#### Scenario: Update a missing trip

- GIVEN no trip with the caller-supplied id
- WHEN the agent calls `update_trip` with that id
- THEN the result is `NOT_FOUND: trip <id>` with `isError: true`

### Requirement: Set trip clients

The `set_trip_clients` tool MUST replace the full set of clients assigned to the caller-supplied trip with the supplied `clientIds`.

#### Scenario: Replace trip clients

- GIVEN a trip with an existing set of assigned clients
- WHEN the agent calls `set_trip_clients` with a new `clientIds` list
- THEN the trip's assigned clients are replaced with exactly the supplied ids

### Requirement: Set trip tags

The `set_trip_tags` tool MUST replace the full set of tags assigned to the caller-supplied trip with the supplied `tagIds`. Supplying an empty `tagIds` array MUST clear all tags without error.

#### Scenario: Replace trip tags

- GIVEN a trip with an existing set of tags
- WHEN the agent calls `set_trip_tags` with a new `tagIds` list
- THEN the trip's tags are replaced with exactly the supplied ids

#### Scenario: Clear all tags

- GIVEN a trip with assigned tags
- WHEN the agent calls `set_trip_tags` with an empty `tagIds` array
- THEN the trip ends with no assigned tags
- AND the call succeeds

### Requirement: Save a trip as a template

The `save_trip_as_template` tool MUST create a new template from the caller-supplied trip's day/item structure, using the supplied `title`, and MUST return the created template. When the trip does not exist, the tool MUST return `NOT_FOUND: trip <id>`.

#### Scenario: Save as template

- GIVEN an existing trip with days and items
- WHEN the agent calls `save_trip_as_template` with the trip's id and a title
- THEN a template is created carrying that trip's day/item structure
- AND the result contains the new template

#### Scenario: Save from a missing trip

- GIVEN no trip with the caller-supplied id
- WHEN the agent calls `save_trip_as_template` with that id
- THEN the result is `NOT_FOUND: trip <id>` with `isError: true`

### Requirement: List templates

The `list_templates` tool MUST return the available trip templates, each including its identifier.

#### Scenario: List templates

- GIVEN one or more templates exist
- WHEN the agent calls `list_templates`
- THEN the result contains the templates
- AND each template includes its id

#### Scenario: No templates

- GIVEN no templates exist
- WHEN the agent calls `list_templates`
- THEN the result is an empty list

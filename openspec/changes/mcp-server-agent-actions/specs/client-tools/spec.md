# Delta for Client Tools

## ADDED Requirements

These tools wrap `src/lib/data.ts` client functions and are exposed only through the MCP server (see the `mcp-server` capability). Authentication failures are governed by the MCP server authentication requirement (HTTP `401`). Invalid-input errors are rejected by the tool's Zod schema before `data.ts` is reached; not-found errors return a structured tool error.

### Requirement: list_clients

The `list_clients` tool SHALL return a paginated list of clients. Key inputs: `page?` (number), `pageSize?` (number). Success result: `{ items: Client[], totalCount: number }`. Excludes no client (all clients regardless of trip status). Invalid pagination values are rejected by the schema.

#### Scenario: Returns a paginated client list

- GIVEN Supabase is configured and at least one client exists
- WHEN `list_clients` is called with `{ page: 1, pageSize: 20 }`
- THEN the result contains `items` (an array of Client) and `totalCount`

#### Scenario: Invalid pagination is rejected

- GIVEN a caller sends `pageSize` as a string
- WHEN the tool validates input
- THEN the call is rejected with a validation error before data access

### Requirement: get_client

The `get_client` tool SHALL return a single client by id. Key inputs: `id` (string, required). Success result: the `Client` object. If no client matches the id, the tool SHALL return a not-found error.

#### Scenario: Returns the requested client

- GIVEN a client with a known id exists
- WHEN `get_client` is called with that id
- THEN the result is the matching `Client` object

#### Scenario: Unknown id returns not-found

- GIVEN no client exists for the supplied id
- WHEN `get_client` is called
- THEN the tool returns a not-found error

### Requirement: create_client

The `create_client` tool SHALL create a client and auto-generate its public slug. Key inputs: `name` (string, required), `email?`, `phone?`, `notes?`, `referralSource?`, `birthDate?` (ISO date string), `coverImageUrl?`. Success result: the created `Client` with `id`, generated `slug`, and `createdAt`/`updatedAt` timestamps. Invalid input (e.g. missing `name`) is rejected by the schema.

#### Scenario: Creates a client with an auto-generated slug

- GIVEN a valid `name` is supplied
- WHEN `create_client` is called
- THEN a `Client` is created and returned with a stable `id` and a generated `slug`

#### Scenario: Missing required name is rejected

- GIVEN the call omits `name`
- WHEN the tool validates input
- THEN the call is rejected with a validation error

### Requirement: update_client

The `update_client` tool SHALL edit client fields. Key inputs: `id` (string, required), plus any of `name?`, `email?`, `phone?`, `notes?`, `referralSource?`, `birthDate?`, `coverImageUrl?`. Success result: the updated `Client`. If the id does not exist, the tool SHALL return a not-found error.

#### Scenario: Updates editable fields

- GIVEN a client exists
- WHEN `update_client` is called with a changed `phone`
- THEN the returned `Client` reflects the new `phone` value

#### Scenario: Unknown id returns not-found

- GIVEN no client matches the supplied id
- WHEN `update_client` is called
- THEN the tool returns a not-found error

### Requirement: get_client_tags

The `get_client_tags` tool SHALL return the tags assigned to a client. Key inputs: `clientId` (string, required). Success result: an array of `Tag` objects.

#### Scenario: Returns assigned tags

- GIVEN a client has assigned tags
- WHEN `get_client_tags` is called with that `clientId`
- THEN the result is the array of `Tag` objects for the client

### Requirement: set_client_tags

The `set_client_tags` tool SHALL set a client's tags using diff semantics (tags absent from the list are removed). Key inputs: `clientId` (string, required), `tagIds` (string[] of existing tag ids, required). Success result: an acknowledgement (e.g. `{ success: true }`). Tag creation/`getOrCreateTag` is handled by the dashboard path and is out of scope here; this tool assigns by existing id.

#### Scenario: Replaces a client's tag set

- GIVEN a client currently has tags `[A, B]`
- WHEN `set_client_tags` is called with `tagIds: [B, C]`
- THEN the client's tags become `[B, C]`

### Requirement: get_client_trips

The `get_client_trips` tool SHALL return a client's trips plus a summary. Key inputs: `clientId` (string, required). Success result: `{ trips: Trip[], summary: ClientTripSummary }` (wrapping `getTripsByClientId` and `getClientTripSummary`). This includes draft, published, and archived trips since the caller is the agent.

#### Scenario: Returns trips and summary

- GIVEN a client has trips in various statuses
- WHEN `get_client_trips` is called
- THEN the result contains all linked `trips` and a `summary` object with counts

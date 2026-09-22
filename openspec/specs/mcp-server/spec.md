# MCP Server Specification

## Purpose

Expose TravelHub domain tools to an external agent over a machine-to-machine Model Context Protocol (MCP) channel. The server MUST authenticate callers with a bearer API key and MUST NOT operate unless the Supabase service role is configured.

## Requirements

### Requirement: Streamable HTTP transport

The system MUST expose the MCP server over a stateless Streamable HTTP transport at `POST /api/mcp` under the Node.js runtime (`runtime = "nodejs"`). Each request MUST be handled independently, with no server-side session state carried between calls.

#### Scenario: Client connects over Streamable HTTP

- GIVEN a client sends a well-formed MCP request to `POST /api/mcp`
- WHEN the request passes authentication and the service-role gate
- THEN the server responds over the Streamable HTTP transport
- AND the response carries a valid MCP JSON-RPC result

#### Scenario: Stateless transport

- GIVEN two consecutive MCP requests from the same client
- WHEN the second request is processed
- THEN the server retains no request-specific state from the first request

### Requirement: Bearer API key authentication

The system MUST reject any MCP request that does not present a valid `MCP_API_KEY` bearer token. A missing or unknown key MUST return HTTP 401 Unauthorized and MUST NOT reach tool dispatch.

#### Scenario: Missing bearer token rejected

- GIVEN a request to `POST /api/mcp` without an `Authorization` header
- WHEN the route processes the request
- THEN the response status is 401
- AND no tool executes

#### Scenario: Invalid bearer token rejected

- GIVEN a request to `POST /api/mcp` with an `Authorization: Bearer` value that is not a configured `MCP_API_KEY`
- WHEN the route processes the request
- THEN the response status is 401
- AND no tool executes

#### Scenario: Valid bearer token accepted

- GIVEN a request to `POST /api/mcp` with the configured `MCP_API_KEY`
- WHEN the route processes the request
- THEN authentication succeeds and the request proceeds to the service-role gate

### Requirement: Service-role configuration gate

The system MUST return HTTP 503 Service Unavailable when the Supabase service role is not configured. Tools MUST NOT be registered or dispatched unless `canUseServiceRole()` evaluates to true.

#### Scenario: Service role unavailable

- GIVEN a valid bearer token but no configured Supabase service-role key
- WHEN the route evaluates service-role availability
- THEN the response status is 503
- AND no tool is registered or dispatched

#### Scenario: Service role available

- GIVEN a valid bearer token and a configured Supabase service-role key
- WHEN the route evaluates service-role availability
- THEN the request proceeds to tool dispatch

### Requirement: No mock-data fallback from MCP

The MCP surface MUST NOT operate against in-memory mock data. When the service role is unavailable, the server MUST fail with 503 rather than falling back to mock implementations.

#### Scenario: Mock data never reachable

- GIVEN the Supabase service role is not configured
- WHEN any MCP tool would otherwise run against mock data
- THEN the request is rejected with 503
- AND no mock-data mutation occurs

### Requirement: Native tool discovery

The MCP server MUST expose its registered tools through the protocol's native tool-listing mechanism (`listTools`), so a connected client can discover the available tool set without out-of-band knowledge. The listing MUST report the full agent surface of exactly 48 tools: the 7 service-document tools plus the 41 agent-action tools (clients, suppliers, trips, trip days, items, packing, internal notes, and documents).
(Previously: the listing returned exactly the registered service-document tools only.)

#### Scenario: Client lists the full tool surface

- GIVEN a connected and authorized MCP client
- WHEN the client calls the native tool-listing operation
- THEN the response lists exactly 48 tools
- AND the listing includes the 7 service-document tools
- AND the listing includes the 41 agent-action tools

#### Scenario: No duplicate tool names

- GIVEN a connected and authorized MCP client
- WHEN the client calls the native tool-listing operation
- THEN every listed tool name is unique
- AND no name collision exists between the service-document and agent-action tool families
### Requirement: No impact on existing routes

Adding the MCP route MUST NOT alter the behavior of any existing dashboard, public, or API route.

#### Scenario: Existing routes unchanged

- GIVEN the MCP route is deployed
- WHEN an existing dashboard or public route is exercised
- THEN its behavior is unchanged from before the change

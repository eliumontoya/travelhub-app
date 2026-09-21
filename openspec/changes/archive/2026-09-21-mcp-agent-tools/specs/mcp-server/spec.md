# Delta for MCP Server

## MODIFIED Requirements

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

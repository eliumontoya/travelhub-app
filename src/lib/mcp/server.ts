import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerServiceDocumentTools } from "@/lib/mcp/tools/service-documents";

/**
 * Constructs an MCP server instance configured for TravelHub. Tools are
 * registered in separate modules (e.g. `tools/service-documents.ts`) and
 * wired in here so the registry stays a single source of truth.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "travelhub-mcp",
    version: "1.0.0",
  });
  registerServiceDocumentTools(server);
  return server;
}
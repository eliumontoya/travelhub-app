import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerClientTools } from "@/lib/mcp/tools/clients";
import { registerDocumentTools } from "@/lib/mcp/tools/documents";
import { registerInternalNoteTools } from "@/lib/mcp/tools/internalNotes";
import { registerItemTools } from "@/lib/mcp/tools/items";
import { registerPackingTools } from "@/lib/mcp/tools/packing";
import { registerServiceDocumentTools } from "@/lib/mcp/tools/service-documents";
import { registerSupplierTools } from "@/lib/mcp/tools/suppliers";
import { registerTripDayTools } from "@/lib/mcp/tools/tripDays";
import { registerTripTools } from "@/lib/mcp/tools/trips";

/**
 * Constructs an MCP server instance configured for TravelHub. Tools are
 * registered in separate modules under `tools/` and wired in here so the
 * registry stays a single source of truth.
 *
 * After the `mcp-agent-tools` change, the server exposes the full agent
 * surface of 48 tools (7 service-document + 41 agent-action). Registration
 * order is stable and matches the design's dependency diagram:
 *
 *   registerServiceDocumentTools(server); //  7 →  7
 *   registerClientTools(server);          // +7 → 14
 *   registerSupplierTools(server);        // +6 → 20
 *   registerTripTools(server);            // +9 → 29
 *   registerTripDayTools(server);         // +6 → 35
 *   registerItemTools(server);            // +7 → 42
 *   registerPackingTools(server);         // +3 → 45
 *   registerInternalNoteTools(server);    // +2 → 47
 *   registerDocumentTools(server);        // +1 → 48
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "travelhub-mcp",
    version: "1.0.0",
  });
  registerServiceDocumentTools(server);
  registerClientTools(server);
  registerSupplierTools(server);
  registerTripTools(server);
  registerTripDayTools(server);
  registerItemTools(server);
  registerPackingTools(server);
  registerInternalNoteTools(server);
  registerDocumentTools(server);
  return server;
}
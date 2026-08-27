import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { registerClientTools } from "./tools/clients";
import { registerSupplierTools } from "./tools/suppliers";
import { registerTripTools } from "./tools/trips";
import { registerTripDayTools } from "./tools/tripDays";
import { registerItemTools } from "./tools/items";
import { registerPackingTools } from "./tools/packing";
import { registerInternalNoteTools } from "./tools/internalNotes";
import { registerDocumentTools } from "./tools/documents";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "travelhub-mcp",
    version: "1.0.0",
  });

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

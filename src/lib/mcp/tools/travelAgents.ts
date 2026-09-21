import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Local safeCall helper: wrap a data-layer call into a `success()` envelope,
 * routing throws to the sanitized `unexpectedError`. Mirrors the style in
 * `clients.ts` (deliberately local).
 */
async function safeCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    return success(await fn());
  } catch (err) {
    return unexpectedError(err);
  }
}

/**
 * Registers the five travel-agent MCP tools. Each tool calls the data layer
 * directly (no injected client); the route's `validateMcpApiKey()` +
 * `canUseServiceRole()` gate is the single boundary protecting the surface.
 */
export function registerTravelAgentTools(server: McpServer): void {
  server.tool(
    "list_travel_agents",
    "Lista los agentes de viajes del catálogo.",
    {},
    async () => safeCall(() => data.getTravelAgents())
  );

  server.tool(
    "get_travel_agent",
    "Devuelve un agente de viajes por id, o `NOT_FOUND: travel agent <id>` si no existe.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      const agent = await data.getTravelAgentById(id);
      if (!agent) return notFound("travel agent", id);
      return success(agent);
    }
  );

  server.tool(
    "create_travel_agent",
    "Crea un agente de viajes a partir de un `name` obligatorio y los campos opcionales `email`, `phone`, `notes`.",
    {
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    },
    async (input) => safeCall(() => data.createTravelAgent(input))
  );

  server.tool(
    "update_travel_agent",
    "Edita los campos de un agente de viajes existente; devuelve `NOT_FOUND: travel agent <id>` si no existe.",
    {
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
    },
    async ({ id, ...input }) => {
      const existing = await data.getTravelAgentById(id);
      if (!existing) return notFound("travel agent", id);
      return safeCall(() => data.updateTravelAgent(id, input));
    }
  );

  server.tool(
    "delete_travel_agent",
    "Elimina un agente de viajes por id. Devuelve `{ success: true }`.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.deleteTravelAgent(id);
      return success({ success: true });
    }
  );
}

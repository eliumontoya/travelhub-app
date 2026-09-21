import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { isNotFoundMessage, safeMessage, unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Local safeCall helper. Mirrors `service-documents.ts`; deliberately local
 * so `utils.ts` stays unchanged.
 */
async function safeCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    return success(await fn());
  } catch (err) {
    return unexpectedError(err);
  }
}

/**
 * Registers the three packing-list MCP tools. Each tool calls the data layer
 * directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface.
 *
 * `update_packing_item` relies on `isNotFoundMessage` + `safeMessage` to map
 * data-layer not-found throws to `notFound("packing item", id)` because
 * `unexpectedError` no longer performs that mapping.
 */
export function registerPackingTools(server: McpServer): void {
  server.tool(
    "add_packing_item",
    "Agrega un item a la packing list del viaje.",
    {
      tripId: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().int().optional(),
    },
    async ({ tripId, label, sortOrder }) =>
      safeCall(() => data.createPackingItem({ tripId, label, sortOrder }))
  );

  server.tool(
    "update_packing_item",
    "Edita un item de la packing list (label, checked, sortOrder). `NOT_FOUND: packing item <id>` si la capa de datos lanza 'no encontrado'.",
    {
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      checked: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    },
    async ({ id, ...input }) => {
      try {
        const item = await data.updatePackingItem(id, input);
        return success(item);
      } catch (err) {
        if (isNotFoundMessage(safeMessage(err))) return notFound("packing item", id);
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "delete_packing_item",
    "Elimina un item de la packing list.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.deletePackingItem(id);
      return success({ success: true });
    }
  );
}
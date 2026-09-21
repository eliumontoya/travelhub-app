import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { isNotFoundMessage, safeMessage, unexpectedError } from "@/lib/mcp/tools/utils";

const itemTypeSchema = z.enum([
  "flight",
  "hotel",
  "activity",
  "restaurant",
  "transport",
  "note",
]);

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
 * Registers the seven itinerary-item MCP tools. Each tool calls the data
 * layer directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface.
 *
 * `update_item` and `duplicate_item` rely on `isNotFoundMessage` +
 * `safeMessage` to map data-layer not-found throws to `notFound("item", id)`
 * because `unexpectedError` no longer performs that mapping.
 */
export function registerItemTools(server: McpServer): void {
  server.tool(
    "add_item",
    "Agrega un item a un día de viaje (`type` ∈ flight|hotel|activity|restaurant|transport|note).",
    {
      tripDayId: z.string().min(1),
      type: itemTypeSchema,
      title: z.string().min(1),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      confirmationCode: z.string().optional(),
      notes: z.string().optional(),
      cost: z.number().optional(),
      sortOrder: z.number().int().optional(),
      supplierId: z.string().min(1).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
    async (input) => safeCall(() => data.createItem(input))
  );

  server.tool(
    "update_item",
    "Edita un item existente. `NOT_FOUND: item <id>` si la capa de datos lanza 'no encontrado'.",
    {
      id: z.string().min(1),
      type: itemTypeSchema.optional(),
      title: z.string().min(1).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      confirmationCode: z.string().optional(),
      notes: z.string().optional(),
      cost: z.number().optional(),
      sortOrder: z.number().int().optional(),
      supplierId: z.string().min(1).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ id, ...input }) => {
      try {
        const item = await data.updateItem(id, input);
        return success(item);
      } catch (err) {
        if (isNotFoundMessage(safeMessage(err))) return notFound("item", id);
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "delete_item",
    "Soft-delete de un item.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.deleteItem(id);
      return success({ success: true });
    }
  );

  server.tool(
    "restore_item",
    "Restaura un item soft-deleted.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.restoreItem(id);
      return success({ success: true });
    }
  );

  server.tool(
    "move_item",
    "Mueve un item a otro día de viaje.",
    {
      itemId: z.string().min(1),
      targetDayId: z.string().min(1),
    },
    async ({ itemId, targetDayId }) => {
      await data.moveItemToDay(itemId, targetDayId);
      return success({ success: true });
    }
  );

  server.tool(
    "duplicate_item",
    "Duplica un item, opcionalmente a otro día. Si omite `targetDayId`, duplica en el mismo día (lo resuelve via `getItemById`).",
    {
      itemId: z.string().min(1),
      targetDayId: z.string().min(1).optional(),
    },
    async ({ itemId, targetDayId }) => {
      let destinationDayId = targetDayId;
      if (!destinationDayId) {
        const source = await data.getItemById(itemId);
        if (!source) return notFound("item", itemId);
        destinationDayId = source.tripDayId;
      }
      try {
        const item = await data.duplicateItem(itemId, destinationDayId);
        return success(item);
      } catch (err) {
        if (isNotFoundMessage(safeMessage(err))) return notFound("item", itemId);
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "reorder_items",
    "Reordena items dentro de un día intercambiando `sortOrder`.",
    {
      order: z
        .array(z.object({ id: z.string().min(1), sortOrder: z.number().int() }))
        .min(1),
    },
    async ({ order }) => {
      await data.reorderItems(order);
      return success({ success: true });
    }
  );
}
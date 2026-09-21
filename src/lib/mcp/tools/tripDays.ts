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
 * Registers the six trip-day MCP tools. Each tool calls the data layer
 * directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface.
 *
 * `update_trip_day` and `generate_trip_days` rely on `isNotFoundMessage` +
 * `safeMessage` to map data-layer not-found throws to `notFound(resource, id)`
 * because `unexpectedError` no longer performs that mapping.
 */
export function registerTripDayTools(server: McpServer): void {
  server.tool(
    "add_trip_day",
    "Agrega un día al viaje con `date` obligatorio.",
    {
      tripId: z.string().min(1),
      date: z.string().min(1),
      notes: z.string().optional(),
      sortOrder: z.number().int().optional(),
    },
    async ({ tripId, date, notes, sortOrder }) =>
      safeCall(() => data.createTripDay({ tripId, date, notes, sortOrder }))
  );

  server.tool(
    "update_trip_day",
    "Edita fecha, notas u orden de un día de viaje. `NOT_FOUND: trip day <id>` si la capa de datos lanza 'no encontrado'.",
    {
      id: z.string().min(1),
      date: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().int().optional(),
    },
    async ({ id, ...input }) => {
      try {
        const day = await data.updateTripDay(id, input);
        return success(day);
      } catch (err) {
        if (isNotFoundMessage(safeMessage(err))) return notFound("trip day", id);
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "delete_trip_day",
    "Soft-delete de un día de viaje.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.deleteTripDay(id);
      return success({ success: true });
    }
  );

  server.tool(
    "restore_trip_day",
    "Restaura un día de viaje soft-deleted.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.restoreTripDay(id);
      return success({ success: true });
    }
  );

  server.tool(
    "generate_trip_days",
    "Genera los días del viaje a partir de `startDate` / `endDate`. `NOT_FOUND: trip <id>` si el viaje no existe.",
    {
      tripId: z.string().min(1),
    },
    async ({ tripId }) => {
      try {
        const result = await data.generateTripDays(tripId);
        return success(result);
      } catch (err) {
        if (isNotFoundMessage(safeMessage(err))) return notFound("trip", tripId);
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "reorder_trip_days",
    "Reordena los días de un viaje intercambiando `sortOrder`.",
    {
      order: z
        .array(z.object({ id: z.string().min(1), sortOrder: z.number().int() }))
        .min(1),
    },
    async ({ order }) => {
      await data.reorderTripDays(order);
      return success({ success: true });
    }
  );
}
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { mcpError, success } from "@/lib/mcp/errors";
import { unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Maps a traveler-activity result (`{ ok: true, item? }` or
 * `{ ok: false, reason: "unauthorized" | "invalid" }`) into an MCP envelope.
 * Authorization/validation refusals become an actionable `isError` result;
 * success returns the created/updated item (or a bare success for deletes).
 */
function mapTravelerActivityResult(
  result: { ok: boolean; item?: unknown; reason?: string }
): CallToolResult {
  if (result.ok) {
    return result.item !== undefined ? success(result.item) : success({ success: true });
  }
  const reason = (result.reason ?? "unknown").toUpperCase();
  return mcpError(`${reason}: traveler activity rejected`);
}

/**
 * Registers the four traveler-activity MCP tools. These wrap the
 * service-role RPC-backed functions that enforce the traveler-eligibility
 * guard (unauthorized → `{ ok: false }`), so no extra ownership check is
 * needed here.
 */
export function registerTravelerActivityTools(server: McpServer): void {
  server.tool(
    "can_client_add_activities",
    "Devuelve `true` si el cliente autenticado puede agregar actividades al viaje.",
    {
      tripId: z.string().min(1),
      clientId: z.string().min(1),
    },
    async ({ tripId, clientId }) => {
      try {
        return success(await data.canClientAddActivities(tripId, clientId));
      } catch (err) {
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "create_traveler_activity",
    "Crea una actividad para un cliente en un día de viaje. Requiere `tripId`, `tripDayId`, `clientId` y `title`.",
    {
      tripId: z.string().min(1),
      tripDayId: z.string().min(1),
      clientId: z.string().min(1),
      title: z.string().min(1),
      startTime: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    },
    async (input) => mapTravelerActivityResult(await data.createTravelerActivity(input))
  );

  server.tool(
    "update_traveler_activity",
    "Edita una actividad de un cliente. Requiere `tripId`, `tripDayId`, `clientId`, `itemId` y `title`.",
    {
      tripId: z.string().min(1),
      tripDayId: z.string().min(1),
      clientId: z.string().min(1),
      itemId: z.string().min(1),
      title: z.string().min(1),
      startTime: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    },
    async (input) => mapTravelerActivityResult(await data.updateTravelerActivity(input))
  );

  server.tool(
    "delete_traveler_activity",
    "Elimina una actividad de un cliente. Requiere `tripId`, `tripDayId`, `clientId` y `itemId`.",
    {
      tripId: z.string().min(1),
      tripDayId: z.string().min(1),
      clientId: z.string().min(1),
      itemId: z.string().min(1),
    },
    async (input) => mapTravelerActivityResult(await data.deleteTravelerActivity(input))
  );
}

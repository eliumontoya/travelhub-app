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
 * Registers the two internal-notes MCP tools. Each tool calls the data
 * layer directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface. Notes are agent-only (never exposed on the
 * public /t/[slug] route).
 */
export function registerInternalNoteTools(server: McpServer): void {
  server.tool(
    "get_trip_internal_notes",
    "Lee las notas internas (agent-only) de un viaje. `NOT_FOUND: trip <id>` si el viaje no existe.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      const existing = await data.getTripById(id);
      if (!existing) return notFound("trip", id);
      return safeCall(async () => ({ internalNotes: await data.getTripInternalNotes(id) }));
    }
  );

  server.tool(
    "update_trip_internal_notes",
    "Escribe las notas internas (agent-only) de un viaje. `NOT_FOUND: trip <id>` si el viaje no existe.",
    {
      id: z.string().min(1),
      internalNotes: z.string().nullable(),
    },
    async ({ id, internalNotes }) => {
      const existing = await data.getTripById(id);
      if (!existing) return notFound("trip", id);
      try {
        await data.updateTripInternalNotes(id, internalNotes);
        return success({ success: true });
      } catch (err) {
        if (isNotFoundMessage(safeMessage(err))) return notFound("trip", id);
        return unexpectedError(err);
      }
    }
  );
}
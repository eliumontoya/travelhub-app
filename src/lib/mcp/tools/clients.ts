import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Local safeCall helper: wrap a data-layer call into a `success()` envelope,
 * routing throws to the sanitized `unexpectedError`. Mirrors the style in
 * `service-documents.ts` (deliberately local — `utils.ts` is intentionally
 * unchanged).
 */
async function safeCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    return success(await fn());
  } catch (err) {
    return unexpectedError(err);
  }
}

/**
 * Registers the seven client MCP tools. Each tool calls the data layer
 * directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface.
 */
export function registerClientTools(server: McpServer): void {
  server.tool(
    "list_clients",
    "Lista los clientes del agente con paginación opcional (page, pageSize).",
    {
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    },
    async ({ page, pageSize }) =>
      safeCall(() => data.getClients({ page, pageSize }))
  );

  server.tool(
    "get_client",
    "Devuelve un cliente por id, o `NOT_FOUND: client <id>` si no existe.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      const client = await data.getClientById(id);
      if (!client) return notFound("client", id);
      return success(client);
    }
  );

  server.tool(
    "create_client",
    "Crea un cliente a partir de un `name` obligatorio y los campos opcionales `email`, `phone`, `notes`, `referralSource`, `birthDate`, `coverImageUrl`.",
    {
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      referralSource: z.string().optional(),
      birthDate: z.string().optional(),
      coverImageUrl: z.string().url().optional(),
    },
    async (input) => safeCall(() => data.createClient(input))
  );

  server.tool(
    "update_client",
    "Edita los campos de un cliente existente; devuelve `NOT_FOUND: client <id>` si no existe.",
    {
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      referralSource: z.string().optional(),
      birthDate: z.string().optional(),
      coverImageUrl: z.string().url().optional(),
    },
    async ({ id, ...input }) => {
      const existing = await data.getClientById(id);
      if (!existing) return notFound("client", id);
      return safeCall(() => data.updateClient(id, input));
    }
  );

  server.tool(
    "get_client_tags",
    "Devuelve los tags asignados al cliente (lista vacía si no tiene).",
    {
      clientId: z.string().min(1),
    },
    async ({ clientId }) => safeCall(() => data.getClientTags(clientId))
  );

  server.tool(
    "set_client_tags",
    "Reemplaza el set completo de tags del cliente (vaciar con `tagIds: []`).",
    {
      clientId: z.string().min(1),
      tagIds: z.array(z.string().min(1)),
    },
    async ({ clientId, tagIds }) => {
      await data.setClientTags(clientId, tagIds);
      return success({ success: true });
    }
  );

  server.tool(
    "get_client_trips",
    "Devuelve `{ trips, summary }` para el cliente: viajes asignados y conteos por estado (total, published, draft, archived).",
    {
      clientId: z.string().min(1),
    },
    async ({ clientId }) =>
      safeCall(async () => {
        const [trips, summary] = await Promise.all([
          data.getTripsByClientId(clientId),
          data.getClientTripSummary(clientId),
        ]);
        return { trips, summary };
      })
  );
}
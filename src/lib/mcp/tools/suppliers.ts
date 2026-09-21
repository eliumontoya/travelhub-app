import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { mcpError, notFound, success } from "@/lib/mcp/errors";
import { unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Local safeCall helper: wrap a data-layer call into a `success()` envelope,
 * routing throws to the sanitized `unexpectedError`. Mirrors the style in
 * `service-documents.ts` (deliberately local — `utils.ts` is unchanged).
 */
async function safeCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    return success(await fn());
  } catch (err) {
    return unexpectedError(err);
  }
}

/**
 * Registers the six supplier MCP tools. Each tool calls the data layer
 * directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface.
 */
export function registerSupplierTools(server: McpServer): void {
  server.tool(
    "list_suppliers",
    "Lista proveedores con paginación y filtros opcionales (query, type, tag).",
    {
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      query: z.string().optional(),
      type: z.string().optional(),
      tag: z.string().optional(),
    },
    async ({ page, pageSize, query, type, tag }) =>
      safeCall(() => data.getSuppliers({ page, pageSize, query, type, tag }))
  );

  server.tool(
    "get_supplier",
    "Devuelve un proveedor por id, o `NOT_FOUND: supplier <id>` si no existe.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      const supplier = await data.getSupplierById(id);
      if (!supplier) return notFound("supplier", id);
      return success(supplier);
    }
  );

  server.tool(
    "create_supplier",
    "Crea un proveedor. `name` y `type` son obligatorios; el resto son opcionales.",
    {
      name: z.string().min(1),
      type: z.string().min(1),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      website: z.string().url().optional(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string().min(1)).optional(),
    },
    async (input) => safeCall(() => data.createSupplier(input))
  );

  server.tool(
    "update_supplier",
    "Edita un proveedor existente; devuelve `NOT_FOUND: supplier <id>` si no existe.",
    {
      id: z.string().min(1),
      name: z.string().min(1).optional(),
      type: z.string().min(1).optional(),
      contactPhone: z.string().optional(),
      contactEmail: z.string().email().optional(),
      website: z.string().url().optional(),
      address: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string().min(1)).optional(),
    },
    async ({ id, ...input }) => {
      const existing = await data.getSupplierById(id);
      if (!existing) return notFound("supplier", id);
      return safeCall(() => data.updateSupplier(id, input));
    }
  );

  server.tool(
    "delete_supplier",
    "Soft-delete de un proveedor. Si tiene items asociados y no se pasa `force=true`, devuelve el conteo de items como señal de negocio.",
    {
      id: z.string().min(1),
      force: z.boolean().optional(),
    },
    async ({ id, force }) => {
      const existing = await data.getSupplierById(id);
      if (!existing) return notFound("supplier", id);
      const result = await data.softDeleteSupplier(id, force);
      if (!result.ok) {
        // Static, secret-free reference-count message — the only
        // `mcpError`-with-text in the agent-action surface, by design.
        return mcpError(
          `Supplier is referenced by ${result.itemCount} item(s). Use force=true to delete anyway.`
        );
      }
      return success({ success: true });
    }
  );

  server.tool(
    "restore_supplier",
    "Restaura un proveedor soft-deleted.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      await data.restoreSupplier(id);
      return success({ success: true });
    }
  );
}
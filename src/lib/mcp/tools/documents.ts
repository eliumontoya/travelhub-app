import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { success } from "@/lib/mcp/errors";
import { unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Registers the single `get_document_upload_url` MCP tool. The tool calls
 * the data layer directly (no injected client, no AsyncLocalStorage); the
 * route's `validateMcpApiKey()` + `canUseServiceRole()` gate is the single
 * boundary that protects the surface.
 *
 * `expiresIn` is metadata-only — storage-js `createSignedUploadUrl` does
 * not honor it (the server applies token TTL). We accept it for caller
 * discipline and echo it back in the response envelope.
 */
export function registerDocumentTools(server: McpServer): void {
  server.tool(
    "get_document_upload_url",
    "Firma una URL de subida (PUT) service-role para un `path` en el bucket privado `trip-documents`. El agente usa la URL fuera de banda para subir los bytes (PUT).",
    {
      path: z.string().min(1),
      expiresIn: z.number().int().min(60).max(604800).optional(),
    },
    async ({ path, expiresIn }) => {
      const resolvedExpiresIn = expiresIn ?? 300;
      try {
        const uploadUrl = await data.getSignedServiceDocumentUploadUrl(path, resolvedExpiresIn);
        return success({ uploadUrl, expiresIn: resolvedExpiresIn });
      } catch (err) {
        return unexpectedError(err);
      }
    }
  );
}
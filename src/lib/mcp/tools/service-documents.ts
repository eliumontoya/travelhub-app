import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { getSignedServiceDocumentDownloadUrl } from "@/lib/data/documents";
import {
  assertServiceUploadMutable,
  getServiceChecklistForTrip,
  getServiceDocumentSummariesForTrip,
  getServicesForTrip,
  markUploadProcessed,
  markUploadReviewed,
  requestReUpload,
} from "@/lib/data/services";
import { mcpError, notFound, success } from "@/lib/mcp/errors";
import { safeMessage, unexpectedError } from "@/lib/mcp/tools/utils";

/**
 * Maps a guard failure (thrown by `assertServiceUploadMutable`) to the
 * secret-safe MCP error envelope. Distinguishes not-found from archived
 * without leaking the underlying message.
 */
function guardFailure(err: unknown, resource: string, id: string): CallToolResult {
  const message = safeMessage(err).toLowerCase();
  // Order matters: the more specific service-not-found must be tested before
  // the generic upload-not-found so that "Servicio no encontrado" surfaces the
  // right resource label. Cross-trip ownership mismatches are intentionally
  // mapped to "upload" (existence-safe).
  if (message.includes("servicio no encontrado")) {
    return notFound("service", id);
  }
  if (
    message.includes("no encontrado") ||
    message.includes("no pertenece")
  ) {
    return notFound(resource, id);
  }
  if (message.includes("archivado")) {
    return mcpError("El viaje archivado es de solo lectura");
  }
  return unexpectedError(err);
}

async function safeCall<T>(fn: () => Promise<T>): Promise<CallToolResult> {
  try {
    return success(await fn());
  } catch (err) {
    return unexpectedError(err);
  }
}

/**
 * Registers the seven service-document MCP tools. Pure data-layer wiring:
 * tools call the data functions directly and rely on the route's auth and
 * service-role gates to protect the surface.
 */
export function registerServiceDocumentTools(server: McpServer): void {
  server.tool(
    "list_services",
    "Lista los servicios de un viaje del agente (incluye cada `service.id`).",
    {
      tripId: z.string().min(1),
    },
    async ({ tripId }) =>
      safeCall(async () => {
        const services = await getServicesForTrip(tripId);
        return services;
      })
  );

  server.tool(
    "get_service_checklist",
    "Devuelve el checklist de un servicio con el `filePath`, `status` y `fileRemoved` de cada upload. NO embebe URLs firmadas (usa `get_service_upload_download_url` con el `filePath` para obtener una).",
    {
      tripId: z.string().min(1),
      serviceId: z.string().min(1),
    },
    async ({ tripId, serviceId }) =>
      safeCall(async () => {
        const checklist = await getServiceChecklistForTrip(tripId, serviceId);
        return checklist;
      })
  );

  server.tool(
    "get_service_document_summaries",
    "Devuelve conteos compactos (processed/total / awaitingReview) por servicio del viaje.",
    {
      tripId: z.string().min(1),
    },
    async ({ tripId }) =>
      safeCall(async () => {
        const summaries = await getServiceDocumentSummariesForTrip(tripId);
        return summaries;
      })
  );

  server.tool(
    "get_service_upload_download_url",
    "Firma una URL de descarga service-role para el `filePath` de un upload (válida aunque el bucket sea privado).",
    {
      path: z.string().min(1),
      expiresIn: z.number().int().min(60).max(604800).optional(),
    },
    async ({ path, expiresIn }) => {
      const resolvedExpiresIn = expiresIn ?? 3600;
      try {
        const url = await getSignedServiceDocumentDownloadUrl(
          path,
          resolvedExpiresIn
        );
        return success({ url, expiresIn: resolvedExpiresIn });
      } catch (err) {
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "process_service_upload",
    "Marca el upload como `processed`: borra el objeto del bucket, conserva la fila y fija `file_removed=true`. Rechaza viajes archivados y uploads ajenos al `tripId`.",
    {
      tripId: z.string().min(1),
      uploadId: z.string().min(1),
    },
    async ({ tripId, uploadId }) => {
      try {
        await assertServiceUploadMutable(uploadId, tripId);
        await markUploadProcessed(uploadId);
        return success({ processed: true });
      } catch (err) {
        return guardFailure(err, "upload", uploadId);
      }
    }
  );

  server.tool(
    "mark_service_upload_reviewed",
    "Marca el upload como `reviewed`. Rechaza viajes archivados y uploads ajenos al `tripId`.",
    {
      tripId: z.string().min(1),
      uploadId: z.string().min(1),
    },
    async ({ tripId, uploadId }) => {
      try {
        await assertServiceUploadMutable(uploadId, tripId);
        await markUploadReviewed(uploadId);
        return success({ reviewed: true });
      } catch (err) {
        return guardFailure(err, "upload", uploadId);
      }
    }
  );

  server.tool(
    "request_service_upload_reupload",
    "Pide un re-upload con un comentario no vacío (`agentComment`). Rechaza viajes archivados y uploads ajenos al `tripId`.",
    {
      tripId: z.string().min(1),
      uploadId: z.string().min(1),
      comment: z.string().min(1),
    },
    async ({ tripId, uploadId, comment }) => {
      try {
        await assertServiceUploadMutable(uploadId, tripId);
        await requestReUpload(uploadId, comment);
        return success({ reuploadRequested: true });
      } catch (err) {
        return guardFailure(err, "upload", uploadId);
      }
    }
  );
}
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { slugify } from "@/lib/slugify";
import { isNotFoundMessage, safeMessage, unexpectedError } from "@/lib/mcp/tools/utils";

const tripStatusSchema = z.enum(["draft", "published", "archived"]);
const tripCurrencySchema = z.enum(["MXN", "USD", "EUR"]);

/**
 * Stable, collision-resistant slug for `create_trip` /
 * `create_trip_from_template`. Mirrors `dashboard/trips/new/actions.ts`:
 * `slugify(title) || "viaje"` plus a `Date.now().toString(36)` uniqueness
 * suffix. Required because `CreateTripInput.slug` is mandatory on the data
 * layer.
 */
function generateTripSlug(title: string): string {
  const base = slugify(title) || "viaje";
  return `${base}-${Date.now().toString(36)}`;
}

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
 * Registers the nine trip / template MCP tools. Each tool calls the data
 * layer directly (no injected client, no AsyncLocalStorage); the route's
 * `validateMcpApiKey()` + `canUseServiceRole()` gate is the single boundary
 * that protects the surface.
 */
export function registerTripTools(server: McpServer): void {
  server.tool(
    "list_trips",
    "Lista viajes con paginación y filtros opcionales (query, status, currency, clientId, tagId, rango de fechas).",
    {
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      query: z.string().optional(),
      status: tripStatusSchema.optional(),
      currency: tripCurrencySchema.optional(),
      clientId: z.string().min(1).optional(),
      tagId: z.string().min(1).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
    async ({ page, pageSize, query, status, currency, clientId, tagId, startDate, endDate }) =>
      safeCall(() =>
        data.getTripsWithClients({
          page,
          pageSize,
          filters: {
            query,
            status: status ? [status] : undefined,
            currency,
            clientIds: clientId ? [clientId] : undefined,
            tagIds: tagId ? [tagId] : undefined,
            dateFrom: startDate,
            dateTo: endDate,
          },
        })
      )
  );

  server.tool(
    "get_trip",
    "Devuelve un viaje (con días, items, clientes y notas internas) por id, o `NOT_FOUND: trip <id>` si no existe.",
    {
      id: z.string().min(1),
    },
    async ({ id }) => {
      const trip = await data.getTripById(id);
      if (!trip) return notFound("trip", id);
      return success(trip);
    }
  );

  server.tool(
    "create_trip",
    "Crea un viaje. Requiere `title` y al menos un `clientId`; genera el `slug` internamente.",
    {
      clientIds: z.array(z.string().min(1)).min(1),
      title: z.string().min(1),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      instructions: z.string().optional(),
      travelerCount: z.number().int().min(1).optional(),
      tagIds: z.array(z.string().min(1)).optional(),
      currency: tripCurrencySchema.optional(),
      isTemplate: z.boolean().optional(),
    },
    async ({
      clientIds,
      title,
      startDate,
      endDate,
      instructions,
      travelerCount,
      tagIds,
      currency,
      isTemplate,
    }) =>
      safeCall(() =>
        data.createTrip({
          clientIds,
          title,
          slug: generateTripSlug(title),
          startDate,
          endDate,
          instructions,
          travelerCount,
          tagIds,
          currency,
          isTemplate,
        })
      )
  );

  server.tool(
    "create_trip_from_template",
    "Crea un viaje nuevo copiando días e items desde un template. Requiere `clientIds` (min 1); usa `title` del template si no se provee.",
    {
      templateId: z.string().min(1),
      title: z.string().min(1).optional(),
      clientIds: z.array(z.string().min(1)).min(1),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
    async ({ templateId, title, clientIds, startDate, endDate }) => {
      const template = await data.getTripById(templateId);
      if (!template) return notFound("template", templateId);
      const tripTitle = title ?? template.title;
      return safeCall(() =>
        data.createTripFromTemplate(templateId, {
          title: tripTitle,
          slug: generateTripSlug(tripTitle),
          clientIds,
          startDate,
          endDate,
        })
      );
    }
  );

  server.tool(
    "update_trip",
    "Edita los metadatos de un viaje (incluyendo `status`, `currency`, `coverImageUrl`, `budget`, `salePrice`, `commissionRate`, `showCostsToClient`). Devuelve `NOT_FOUND: trip <id>` si no existe.",
    {
      id: z.string().min(1),
      title: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      coverImageUrl: z.string().url().optional(),
      instructions: z.string().optional(),
      travelerCount: z.number().int().min(1).optional(),
      budget: z.number().nullable().optional(),
      status: tripStatusSchema.optional(),
      currency: tripCurrencySchema.optional(),
      showCostsToClient: z.boolean().optional(),
      salePrice: z.number().nullable().optional(),
      commissionRate: z.number().nullable().optional(),
      assignedAgentId: z.string().nullable().optional(),
    },
    async ({ id, ...input }) => {
      const existing = await data.getTripById(id);
      if (!existing) return notFound("trip", id);
      return safeCall(() => data.updateTrip(id, input));
    }
  );

  server.tool(
    "set_trip_clients",
    "Reemplaza los clientes del viaje (requiere al menos uno).",
    {
      tripId: z.string().min(1),
      clientIds: z.array(z.string().min(1)).min(1),
    },
    async ({ tripId, clientIds }) => {
      await data.setTripClients(tripId, clientIds);
      return success({ success: true });
    }
  );

  server.tool(
    "set_trip_tags",
    "Reemplaza los tags del viaje (vaciar con `tagIds: []`).",
    {
      tripId: z.string().min(1),
      tagIds: z.array(z.string().min(1)),
    },
    async ({ tripId, tagIds }) => {
      await data.setTripTags(tripId, tagIds);
      return success({ success: true });
    }
  );

  server.tool(
    "save_trip_as_template",
    "Guarda un viaje existente como template reutilizable. Devuelve `NOT_FOUND: trip <id>` si no existe (o si la capa de datos lanza un mensaje con 'no encontrado').",
    {
      tripId: z.string().min(1),
      title: z.string().min(1),
    },
    async ({ tripId, title }) => {
      const existing = await data.getTripById(tripId);
      if (!existing) return notFound("trip", tripId);
      try {
        const template = await data.saveTripAsTemplate(tripId, title);
        return success(template);
      } catch (err) {
        // Preserve legacy per-tool not-found mapping that main's
        // `unexpectedError` no longer provides.
        if (isNotFoundMessage(safeMessage(err))) return notFound("trip", tripId);
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "list_templates",
    "Lista todos los viajes marcados como templates.",
    {},
    async () => safeCall(() => data.getTemplates())
  );
}
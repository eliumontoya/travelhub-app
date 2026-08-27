import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import type { Trip } from "@/types";
import { slugify } from "@/lib/slugify";
import { notFound, mcpError, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

const tripCurrencySchema = z.enum(["MXN", "USD", "EUR"]);
const tripStatusSchema = z.enum(["draft", "published", "archived"]);

function generateTripSlug(title: string): string {
  const base = slugify(title) || "viaje";
  return `${base}-${Date.now().toString(36)}`;
}

export function registerTripTools(server: McpServer) {
  server.tool(
    "list_trips",
    "Return a paginated, filtered trip list",
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
    async ({ page, pageSize, query, status, currency, clientId, tagId, startDate, endDate }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const result = await data.getTripsWithClients(
        {
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
        },
        supabase
      );
      return textResult(result);
    }
  );

  server.tool(
    "get_trip",
    "Return the full trip graph including days, items, clients and internal notes",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const trip = await data.getTripById(id, supabase);
      if (!trip) return notFound("trip", id);
      return textResult(trip);
    }
  );

  server.tool(
    "create_trip",
    "Create a trip requiring at least one client; auto-generates a slug",
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
    async ({ clientIds, title, startDate, endDate, instructions, travelerCount, tagIds, currency, isTemplate }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const trip = await data.createTrip(
        {
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
        },
        supabase
      );
      return textResult(trip);
    }
  );

  server.tool(
    "create_trip_from_template",
    "Create a new trip by copying days and items from a template",
    {
      templateId: z.string().min(1),
      title: z.string().min(1).optional(),
      clientIds: z.array(z.string().min(1)).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    },
    async ({ templateId, title, clientIds, startDate, endDate }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const template = await data.getTripById(templateId, supabase);
      if (!template) return notFound("template", templateId);
      const tripTitle = title ?? template.title;
      const trip = await data.createTripFromTemplate(
        templateId,
        {
          title: tripTitle,
          slug: generateTripSlug(tripTitle),
          clientIds,
          startDate,
          endDate,
        },
        supabase
      );
      return textResult(trip);
    }
  );

  server.tool(
    "update_trip",
    "Edit trip metadata and status (draft | published | archived)",
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
    },
    async ({ id, ...input }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getTripById(id, supabase);
      if (!existing) return notFound("trip", id);
      const trip = await data.updateTrip(id, input, supabase);
      return textResult(trip);
    }
  );

  server.tool(
    "set_trip_clients",
    "Assign a trip's clients using diff semantics; requires at least one",
    {
      tripId: z.string().min(1),
      clientIds: z.array(z.string().min(1)).min(1),
    },
    async ({ tripId, clientIds }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.setTripClients(tripId, clientIds, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "set_trip_tags",
    "Assign a trip's tags using diff semantics",
    {
      tripId: z.string().min(1),
      tagIds: z.array(z.string().min(1)),
    },
    async ({ tripId, tagIds }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.setTripTags(tripId, tagIds, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "save_trip_as_template",
    "Save an existing trip as a reusable template",
    {
      tripId: z.string().min(1),
      title: z.string().min(1),
    },
    async ({ tripId, title }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getTripById(tripId, supabase);
      if (!existing) return notFound("trip", tripId);
      try {
        const template = await data.saveTripAsTemplate(tripId, title, supabase);
        return textResult(template);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("no encontrado")) {
          return notFound("trip", tripId);
        }
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "list_templates",
    "List all trips marked as templates",
    {},
    async () => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const templates = await data.getTemplates(supabase);
      return textResult(templates);
    }
  );
}

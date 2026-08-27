import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import { notFound, mcpError, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

export function registerTripDayTools(server: McpServer) {
  server.tool(
    "add_trip_day",
    "Add a day to a trip",
    {
      tripId: z.string().min(1),
      date: z.string().min(1),
      notes: z.string().optional(),
      sortOrder: z.number().int().optional(),
    },
    async ({ tripId, date, notes, sortOrder }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const day = await data.createTripDay({ tripId, date, notes, sortOrder }, supabase);
      return textResult(day);
    }
  );

  server.tool(
    "update_trip_day",
    "Edit a trip day's date, notes or sort order",
    {
      id: z.string().min(1),
      date: z.string().optional(),
      notes: z.string().optional(),
      sortOrder: z.number().int().optional(),
    },
    async ({ id, ...input }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      try {
        const day = await data.updateTripDay(id, input, supabase);
        return textResult(day);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("no encontrado")) {
          return notFound("trip day", id);
        }
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "delete_trip_day",
    "Soft-delete a trip day",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.deleteTripDay(id, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "restore_trip_day",
    "Restore a soft-deleted trip day",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.restoreTripDay(id, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "generate_trip_days",
    "Generate trip days from the trip start and end dates",
    { tripId: z.string().min(1) },
    async ({ tripId }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      try {
        const result = await data.generateTripDays(tripId, supabase);
        return textResult(result);
      } catch (err) {
        return mcpError(err instanceof Error ? err.message : String(err));
      }
    }
  );

  server.tool(
    "reorder_trip_days",
    "Reorder trip days via sort_order swap",
    {
      order: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int() })).min(1),
    },
    async ({ order }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.reorderTripDays(order, supabase);
      return success({ success: true });
    }
  );
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

const itemTypeSchema = z.enum([
  "flight",
  "hotel",
  "activity",
  "restaurant",
  "transport",
  "note",
]);

export function registerItemTools(server: McpServer) {
  server.tool(
    "add_item",
    "Add an item to a trip day",
    {
      tripDayId: z.string().min(1),
      type: itemTypeSchema,
      title: z.string().min(1),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      confirmationCode: z.string().optional(),
      notes: z.string().optional(),
      cost: z.number().optional(),
      sortOrder: z.number().int().optional(),
      supplierId: z.string().min(1).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
    async (input) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const item = await data.createItem(input, supabase);
      return textResult(item);
    }
  );

  server.tool(
    "update_item",
    "Edit an item",
    {
      id: z.string().min(1),
      type: itemTypeSchema.optional(),
      title: z.string().min(1).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      location: z.string().optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      confirmationCode: z.string().optional(),
      notes: z.string().optional(),
      cost: z.number().optional(),
      sortOrder: z.number().int().optional(),
      supplierId: z.string().min(1).optional(),
      metadata: z.record(z.string(), z.unknown()).optional(),
    },
    async ({ id, ...input }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      try {
        const item = await data.updateItem(id, input, supabase);
        return textResult(item);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("no encontrado")) {
          return notFound("item", id);
        }
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "delete_item",
    "Soft-delete an item",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.deleteItem(id, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "restore_item",
    "Restore a soft-deleted item",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.restoreItem(id, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "move_item",
    "Move an item to another trip day",
    {
      itemId: z.string().min(1),
      targetDayId: z.string().min(1),
    },
    async ({ itemId, targetDayId }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.moveItemToDay(itemId, targetDayId, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "duplicate_item",
    "Duplicate an item, optionally into a target day",
    {
      itemId: z.string().min(1),
      targetDayId: z.string().min(1).optional(),
    },
    async ({ itemId, targetDayId }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      let destinationDayId = targetDayId;
      if (!destinationDayId) {
        const source = await data.getItemById(itemId, supabase);
        if (!source) return notFound("item", itemId);
        destinationDayId = source.tripDayId;
      }
      try {
        const item = await data.duplicateItem(itemId, destinationDayId, supabase);
        return textResult(item);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("no encontrado")) {
          return notFound("item", itemId);
        }
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "reorder_items",
    "Reorder items via sort_order swap",
    {
      order: z.array(z.object({ id: z.string().min(1), sortOrder: z.number().int() })).min(1),
    },
    async ({ order }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.reorderItems(order, supabase);
      return success({ success: true });
    }
  );
}

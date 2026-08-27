import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

export function registerPackingTools(server: McpServer) {
  server.tool(
    "add_packing_item",
    "Add a packing checklist item to a trip",
    {
      tripId: z.string().min(1),
      label: z.string().min(1),
      sortOrder: z.number().int().optional(),
    },
    async ({ tripId, label, sortOrder }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const item = await data.createPackingItem({ tripId, label, sortOrder }, supabase);
      return textResult(item);
    }
  );

  server.tool(
    "update_packing_item",
    "Edit a packing item, including toggling checked state",
    {
      id: z.string().min(1),
      label: z.string().min(1).optional(),
      checked: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    },
    async ({ id, ...input }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      try {
        const item = await data.updatePackingItem(id, input, supabase);
        return textResult(item);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes("no encontrado")) {
          return notFound("packing item", id);
        }
        return unexpectedError(err);
      }
    }
  );

  server.tool(
    "delete_packing_item",
    "Remove a packing item",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.deletePackingItem(id, supabase);
      return success({ success: true });
    }
  );
}

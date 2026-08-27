import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

export function registerInternalNoteTools(server: McpServer) {
  server.tool(
    "get_trip_internal_notes",
    "Read a trip's internal agent-only notes",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getTripById(id, supabase);
      if (!existing) return notFound("trip", id);
      const internalNotes = await data.getTripInternalNotes(id, supabase);
      return textResult({ internalNotes });
    }
  );

  server.tool(
    "update_trip_internal_notes",
    "Write a trip's internal agent-only notes",
    {
      id: z.string().min(1),
      internalNotes: z.string().nullable(),
    },
    async ({ id, internalNotes }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getTripById(id, supabase);
      if (!existing) return notFound("trip", id);
      await data.updateTripInternalNotes(id, internalNotes, supabase);
      return success({ success: true });
    }
  );
}

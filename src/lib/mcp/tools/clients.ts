import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import { notFound, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

export function registerClientTools(server: McpServer) {
  server.tool(
    "list_clients",
    "Return a paginated list of clients",
    {
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
    },
    async ({ page, pageSize }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const result = await data.getClients({ page, pageSize }, supabase);
      return textResult(result);
    }
  );

  server.tool(
    "get_client",
    "Fetch a single client by id",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const client = await data.getClientById(id, supabase);
      if (!client) return notFound("client", id);
      return textResult(client);
    }
  );

  server.tool(
    "create_client",
    "Create a client with an auto-generated public slug",
    {
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      notes: z.string().optional(),
      referralSource: z.string().optional(),
      birthDate: z.string().optional(),
      coverImageUrl: z.string().url().optional(),
    },
    async (input) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const client = await data.createClient(input, supabase);
      return textResult(client);
    }
  );

  server.tool(
    "update_client",
    "Edit client fields",
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
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getClientById(id, supabase);
      if (!existing) return notFound("client", id);
      const client = await data.updateClient(id, input, supabase);
      return textResult(client);
    }
  );

  server.tool(
    "get_client_tags",
    "Return the tags assigned to a client",
    { clientId: z.string().min(1) },
    async ({ clientId }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const tags = await data.getClientTags(clientId, supabase);
      return textResult(tags);
    }
  );

  server.tool(
    "set_client_tags",
    "Set a client's tags using diff semantics",
    {
      clientId: z.string().min(1),
      tagIds: z.array(z.string().min(1)),
    },
    async ({ clientId, tagIds }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.setClientTags(clientId, tagIds, supabase);
      return success({ success: true });
    }
  );

  server.tool(
    "get_client_trips",
    "Return a client's trips plus a summary",
    { clientId: z.string().min(1) },
    async ({ clientId }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const [trips, summary] = await Promise.all([
        data.getTripsByClientId(clientId, supabase),
        data.getClientTripSummary(clientId, supabase),
      ]);
      return textResult({ trips, summary });
    }
  );
}

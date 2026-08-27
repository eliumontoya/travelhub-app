import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import * as data from "@/lib/data";
import { notFound, mcpError, success } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

export function registerSupplierTools(server: McpServer) {
  server.tool(
    "list_suppliers",
    "Return a paginated, filtered supplier catalog",
    {
      page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(100).optional(),
      query: z.string().optional(),
      type: z.string().optional(),
      tag: z.string().optional(),
    },
    async ({ page, pageSize, query, type, tag }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const result = await data.getSuppliers({ page, pageSize, query, type, tag }, supabase);
      return textResult(result);
    }
  );

  server.tool(
    "get_supplier",
    "Fetch a single supplier by id",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const supplier = await data.getSupplierById(id, supabase);
      if (!supplier) return notFound("supplier", id);
      return textResult(supplier);
    }
  );

  server.tool(
    "create_supplier",
    "Create a supplier",
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
    async (input) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const supplier = await data.createSupplier(input, supabase);
      return textResult(supplier);
    }
  );

  server.tool(
    "update_supplier",
    "Edit supplier fields",
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
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getSupplierById(id, supabase);
      if (!existing) return notFound("supplier", id);
      const supplier = await data.updateSupplier(id, input, supabase);
      return textResult(supplier);
    }
  );

  server.tool(
    "delete_supplier",
    "Soft-delete a supplier; use force=true to override references",
    {
      id: z.string().min(1),
      force: z.boolean().optional(),
    },
    async ({ id, force }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const existing = await data.getSupplierById(id, supabase);
      if (!existing) return notFound("supplier", id);
      const result = await data.softDeleteSupplier(id, force, supabase);
      if (!result.ok) {
        return mcpError(
          `Supplier is referenced by ${result.itemCount} item(s). Use force=true to delete anyway.`
        );
      }
      return success({ success: true });
    }
  );

  server.tool(
    "restore_supplier",
    "Restore a soft-deleted supplier",
    { id: z.string().min(1) },
    async ({ id }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      await data.restoreSupplier(id, supabase);
      return success({ success: true });
    }
  );
}

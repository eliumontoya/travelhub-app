import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";
import { getSignedDocumentUploadUrl } from "@/lib/data";
import { mcpError } from "@/lib/mcp/errors";
import { getMcpSupabaseClient } from "@/lib/mcp/supabase-store";
import { textResult, unexpectedError } from "./utils";

export function registerDocumentTools(server: McpServer) {
  server.tool(
    "get_document_upload_url",
    "Return a short-lived Supabase Storage PUT URL for direct document upload",
    {
      path: z.string().min(1),
      expiresIn: z.number().int().min(60).max(604800).optional(),
    },
    async ({ path, expiresIn }) => {
      const supabase = getMcpSupabaseClient();
      if (!supabase) return unexpectedError(new Error("Supabase client not available"));
      const uploadUrl = await getSignedDocumentUploadUrl(path, expiresIn ?? 300, supabase);
      if (!uploadUrl) return mcpError("Could not generate upload URL");
      return textResult({ uploadUrl, expiresIn: expiresIn ?? 300 });
    }
  );
}

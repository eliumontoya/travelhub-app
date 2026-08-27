import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import { createMcpServer } from "@/lib/mcp/server";
import { validateMcpApiKey } from "@/lib/mcp/auth";
import { isServiceRoleConfigured, createServiceRoleClient } from "@/lib/supabase/server";
import { runWithMcpSupabase } from "@/lib/mcp/supabase-store";

export const runtime = "nodejs";

async function handleMcpRequest(request: Request): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (!validateMcpApiKey(authHeader)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isServiceRoleConfigured()) {
    return Response.json(
      { error: "MCP server requires Supabase configuration" },
      { status: 503 }
    );
  }

  const supabase = createServiceRoleClient();
  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  return runWithMcpSupabase(supabase, () => transport.handleRequest(request));
}

export const POST = handleMcpRequest;
export const GET = handleMcpRequest;
export const DELETE = handleMcpRequest;

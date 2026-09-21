import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp";
import type { NextRequest } from "next/server";

import { canUseServiceRole } from "@/lib/data/shared";
import { validateMcpApiKey } from "@/lib/mcp/auth";
import { createMcpServer } from "@/lib/mcp/server";

export const runtime = "nodejs";

const UNAUTHORIZED_BODY = { error: "Unauthorized" };
const SERVICE_ROLE_REQUIRED_BODY = {
  error: "MCP server requires Supabase service role",
};

/**
 * Shared handler for POST/GET/DELETE: the MCP Streamable HTTP transport
 * accepts all three verbs. The gate order (auth → service role → dispatch)
 * is enforced identically across every verb so a 401/503 cannot leak a
 * tool call.
 */
async function handleMcpRequest(request: NextRequest): Promise<Response> {
  if (!validateMcpApiKey(request.headers.get("authorization"))) {
    return Response.json(UNAUTHORIZED_BODY, { status: 401 });
  }

  if (!canUseServiceRole()) {
    return Response.json(SERVICE_ROLE_REQUIRED_BODY, { status: 503 });
  }

  const server = createMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function POST(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function GET(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: NextRequest): Promise<Response> {
  return handleMcpRequest(request);
}
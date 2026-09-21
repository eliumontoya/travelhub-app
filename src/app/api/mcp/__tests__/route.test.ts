import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Module-level mocks — every test in this suite uses them.
const canUseServiceRole = vi.fn();
const validateMcpApiKey = vi.fn();
const createMcpServer = vi.fn();
const transportHandleRequest = vi.fn();
const registerServiceDocumentTools = vi.fn();

vi.mock("@/lib/data/shared", () => ({
  canUseServiceRole,
}));

vi.mock("@/lib/mcp/auth", () => ({
  validateMcpApiKey,
}));

vi.mock("@/lib/mcp/server", () => ({
  createMcpServer,
}));

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp", () => {
  class WebStandardStreamableHTTPServerTransport {
    handleRequest = transportHandleRequest;
  }
  return { WebStandardStreamableHTTPServerTransport };
});

vi.mock("@/lib/mcp/tools/service-documents", () => ({
  registerServiceDocumentTools,
}));

function makeRequest(authorization?: string) {
  const headers = authorization ? { authorization } : undefined;
  return new NextRequest("https://travelhub.test/api/mcp", {
    method: "POST",
    headers,
  });
}

async function invokePost(authorization?: string) {
  const { POST } = await import("../route");
  return POST(makeRequest(authorization));
}

async function invokeGet(authorization?: string) {
  const { GET } = await import("../route");
  return GET(makeRequest(authorization));
}

async function invokeDelete(authorization?: string) {
  const { DELETE } = await import("../route");
  return DELETE(makeRequest(authorization));
}

function useRouteEnv({ apiKey = "test-mcp-key", serviceRole = true }: { apiKey?: string; serviceRole?: boolean } = {}) {
  if (apiKey === undefined) {
    vi.stubEnv("MCP_API_KEY", undefined);
  } else {
    vi.stubEnv("MCP_API_KEY", apiKey);
  }
  if (serviceRole) {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role");
  } else {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", undefined);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", undefined);
  }
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  canUseServiceRole.mockReset();
  validateMcpApiKey.mockReset();
  createMcpServer.mockReset();
  transportHandleRequest.mockReset();
  registerServiceDocumentTools.mockReset();

  // Defaults — every test can override.
  validateMcpApiKey.mockReturnValue(false);
  canUseServiceRole.mockReturnValue(true);
  transportHandleRequest.mockResolvedValue(new Response("{}", { status: 200 }));
  createMcpServer.mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/mcp — auth gate (401)", () => {
  it("returns 401 when the Authorization header is missing", async () => {
    useRouteEnv();
    validateMcpApiKey.mockReturnValue(false);

    const response = await invokePost();

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createMcpServer).not.toHaveBeenCalled();
    expect(transportHandleRequest).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token is rejected", async () => {
    useRouteEnv();
    validateMcpApiKey.mockReturnValue(false);

    const response = await invokePost("Bearer wrong-key");

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(createMcpServer).not.toHaveBeenCalled();
    expect(transportHandleRequest).not.toHaveBeenCalled();
  });
});

describe("POST /api/mcp — service-role gate (503)", () => {
  it("returns 503 when validateMcpApiKey accepts but canUseServiceRole is false", async () => {
    useRouteEnv();
    validateMcpApiKey.mockReturnValue(true);
    canUseServiceRole.mockReturnValue(false);

    const response = await invokePost("Bearer test-mcp-key");

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "MCP server requires Supabase service role",
    });
    expect(createMcpServer).not.toHaveBeenCalled();
    expect(transportHandleRequest).not.toHaveBeenCalled();
    expect(registerServiceDocumentTools).not.toHaveBeenCalled();
  });
});

describe("POST /api/mcp — happy path", () => {
  it("constructs the server, registers tools, and delegates to the transport", async () => {
    useRouteEnv();
    validateMcpApiKey.mockReturnValue(true);
    canUseServiceRole.mockReturnValue(true);

    const response = await invokePost("Bearer test-mcp-key");

    expect(response.status).toBe(200);
    expect(createMcpServer).toHaveBeenCalledOnce();
    expect(transportHandleRequest).toHaveBeenCalledOnce();
    expect(registerServiceDocumentTools).not.toHaveBeenCalled();
  });

  it("exports GET and DELETE that share the same gate", async () => {
    useRouteEnv();
    validateMcpApiKey.mockReturnValue(true);
    canUseServiceRole.mockReturnValue(true);

    const getResponse = await invokeGet("Bearer test-mcp-key");
    const deleteResponse = await invokeDelete("Bearer test-mcp-key");

    expect(getResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(transportHandleRequest).toHaveBeenCalledTimes(2);
  });

  it("applies the same 401 to GET and DELETE when the header is missing", async () => {
    useRouteEnv();
    validateMcpApiKey.mockReturnValue(false);

    const getResponse = await invokeGet();
    const deleteResponse = await invokeDelete();

    expect(getResponse.status).toBe(401);
    expect(deleteResponse.status).toBe(401);
    expect(transportHandleRequest).not.toHaveBeenCalled();
  });
});
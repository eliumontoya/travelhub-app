import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isServiceRoleConfigured: () => true,
  createServiceRoleClient: () => ({
    from: vi.fn(),
    storage: { from: vi.fn(() => ({ createSignedUploadUrl: vi.fn() })) },
  }),
}));

import { POST, GET } from "@/app/api/mcp/route";

describe("/api/mcp route", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MCP_API_KEY: "test-mcp-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 401 when Authorization header is missing", async () => {
    const request = new Request("http://localhost/api/mcp", { method: "POST", body: "{}" });
    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 401 when Bearer key does not match", async () => {
    const request = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { Authorization: "Bearer wrong-key" },
      body: "{}",
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("responds to a valid initialize JSON-RPC request", async () => {
    const body = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    };
    const request = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-mcp-key",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.jsonrpc).toBe("2.0");
    expect(json.id).toBe(1);
    expect(json.result).toBeDefined();
    expect(json.result.protocolVersion).toBe("2025-03-26");
  });

  it("handles GET requests for the SSE stream", async () => {
    const request = new Request("http://localhost/api/mcp", {
      method: "GET",
      headers: { Authorization: "Bearer test-mcp-key", Accept: "text/event-stream" },
    });
    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
  });
});

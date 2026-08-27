import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  isServiceRoleConfigured: () => true,
  createServiceRoleClient: () => ({
    from: vi.fn(),
    storage: { from: vi.fn(() => ({ createSignedUploadUrl: vi.fn() })) },
  }),
}));

vi.mock("@/lib/data", async () => {
  const actual = await vi.importActual<typeof import("@/lib/data")>("@/lib/data");
  return {
    ...actual,
    getClientById: vi.fn(),
    createClient: vi.fn(),
    getSupplierById: vi.fn(),
    softDeleteSupplier: vi.fn(),
    getTripById: vi.fn(),
    getSignedDocumentUploadUrl: vi.fn(),
  };
});

import { POST } from "@/app/api/mcp/route";
import * as data from "@/lib/data";

async function mcpRequest(body: Record<string, unknown>) {
  return POST(
    new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-mcp-key",
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": "2025-03-26",
      },
      body: JSON.stringify(body),
    })
  );
}

describe("/api/mcp tools", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, MCP_API_KEY: "test-mcp-key" };
    vi.resetAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("lists all MVP tools", async () => {
    const response = await mcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    const toolNames = json.result.tools.map((t: { name: string }) => t.name);
    expect(toolNames).toContain("get_client");
    expect(toolNames).toContain("create_supplier");
    expect(toolNames).toContain("update_trip");
    expect(toolNames).toContain("get_document_upload_url");
    expect(toolNames.length).toBeGreaterThanOrEqual(41);
  });

  it("returns a structured not-found error for get_client", async () => {
    vi.mocked(data.getClientById).mockResolvedValue(null);

    const response = await mcpRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_client", arguments: { id: "missing" } },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain("NOT_FOUND");
  });

  it("rejects invalid input before reaching data.ts", async () => {
    const response = await mcpRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "create_client", arguments: {} },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text.toLowerCase()).toContain("validation");
  });

  it("calls create_client with valid input", async () => {
    vi.mocked(data.createClient).mockResolvedValue({
      id: "c-new",
      name: "Test",
      slug: "test",
      email: "",
      phone: "",
      referralSource: null,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      status: undefined,
      currency: undefined,
      isTemplate: undefined,
      showCostsToClient: undefined,
      clientId: "",
      title: "",
      slug: "",
      startDate: "",
      endDate: "",
      travelerCount: 0,
    } as unknown as Awaited<ReturnType<typeof data.createClient>>);

    const response = await mcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "create_client", arguments: { name: "Test" } },
    });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.result.isError).toBeUndefined();
    expect(data.createClient).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Test" }),
      expect.anything()
    );
  });

  it("enforces supplier reference constraint on delete_supplier", async () => {
    vi.mocked(data.getSupplierById).mockResolvedValue({
      id: "s1",
      name: "Hotel",
      type: "hotel",
      tags: [],
      deletedAt: undefined,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    } as Awaited<ReturnType<typeof data.getSupplierById>>);
    vi.mocked(data.softDeleteSupplier).mockResolvedValue({ ok: false, itemCount: 3 });

    const response = await mcpRequest({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "delete_supplier", arguments: { id: "s1" } },
    });

    const json = await response.json();
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text).toContain("referenced by 3 item(s)");
  });

  it("returns a document upload URL", async () => {
    vi.mocked(data.getSignedDocumentUploadUrl).mockResolvedValue(
      "https://example.com/upload?token=abc"
    );

    const response = await mcpRequest({
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "get_document_upload_url", arguments: { path: "trips/t1/doc.pdf" } },
    });

    const json = await response.json();
    expect(json.result.isError).toBeUndefined();
    expect(JSON.parse(json.result.content[0].text)).toEqual({
      uploadUrl: "https://example.com/upload?token=abc",
      expiresIn: 300,
    });
  });
});

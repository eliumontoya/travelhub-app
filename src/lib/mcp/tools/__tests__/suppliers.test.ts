import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Data-layer mocks.
const getSuppliers = vi.fn();
const getSupplierById = vi.fn();
const createSupplier = vi.fn();
const updateSupplier = vi.fn();
const softDeleteSupplier = vi.fn();
const restoreSupplier = vi.fn();

vi.mock("@/lib/data", () => ({
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  softDeleteSupplier,
  restoreSupplier,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerSupplierTools } = await import("@/lib/mcp/tools/suppliers");
  const server = new McpServer({ name: "test-suppliers", version: "0.0.0" });
  registerSupplierTools(server);

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  return (await client.callTool({ name, arguments: args })) as unknown as ToolCallResult;
}

function parseToolText(result: ToolCallResult): unknown {
  const block = result.content.find((c) => c.type === "text");
  if (!block?.text) throw new Error("expected a text block");
  return JSON.parse(block.text);
}

function resetMocks() {
  getSuppliers.mockReset();
  getSupplierById.mockReset();
  createSupplier.mockReset();
  updateSupplier.mockReset();
  softDeleteSupplier.mockReset();
  restoreSupplier.mockReset();
}

beforeEach(() => {
  resetMocks();
  getSuppliers.mockResolvedValue({
    items: [{ id: "sup-1", name: "Acme Hotels" }],
    totalCount: 1,
  });
  getSupplierById.mockResolvedValue({ id: "sup-1", name: "Acme Hotels" });
  createSupplier.mockImplementation(async (input) => ({ id: "sup-new", ...input }));
  updateSupplier.mockImplementation(async (id, input) => ({ id, ...input }));
  softDeleteSupplier.mockResolvedValue({ ok: true });
  restoreSupplier.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("list_suppliers", () => {
  it("dispatches to getSuppliers with all filters", async () => {
    const client = await bootClient();
    const result = await callTool(client, "list_suppliers", {
      page: 1,
      pageSize: 50,
      query: "hotel",
      type: "hotel",
      tag: "luxury",
    });

    expect(getSuppliers).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      query: "hotel",
      type: "hotel",
      tag: "luxury",
    });
    const payload = parseToolText(result) as { items: Array<{ id: string }> };
    expect(payload.items[0].id).toBe("sup-1");
  });

  it("supports omitted filters", async () => {
    const client = await bootClient();
    await callTool(client, "list_suppliers", {});
    expect(getSuppliers).toHaveBeenCalledWith({});
  });

  it("sanitizes unexpected throws", async () => {
    getSuppliers.mockRejectedValueOnce(new Error("RLS denied"));
    const client = await bootClient();
    const result = await callTool(client, "list_suppliers", {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("RLS");
  });
});

describe("get_supplier", () => {
  it("returns the supplier when found", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_supplier", { id: "sup-1" });
    expect(getSupplierById).toHaveBeenCalledWith("sup-1");
    const payload = parseToolText(result) as { id: string; name: string };
    expect(payload.name).toBe("Acme Hotels");
  });

  it("maps null to NOT_FOUND: supplier <id>", async () => {
    getSupplierById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "get_supplier", { id: "sup-missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: supplier sup-missing$/);
  });
});

describe("create_supplier", () => {
  it("dispatches to createSupplier and returns the new supplier", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_supplier", {
      name: "Acme",
      type: "hotel",
      contactEmail: "hi@acme.com",
      website: "https://acme.com",
    });

    expect(createSupplier).toHaveBeenCalledWith({
      name: "Acme",
      type: "hotel",
      contactEmail: "hi@acme.com",
      website: "https://acme.com",
    });
    const payload = parseToolText(result) as { id: string; name: string };
    expect(payload.id).toBe("sup-new");
  });

  it("rejects missing name", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_supplier", { type: "hotel" });
    expect(result.isError).toBe(true);
    expect(createSupplier).not.toHaveBeenCalled();
  });

  it("rejects missing type", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_supplier", { name: "Acme" });
    expect(result.isError).toBe(true);
    expect(createSupplier).not.toHaveBeenCalled();
  });
});

describe("update_supplier", () => {
  it("precheck null → NOT_FOUND: supplier <id>", async () => {
    getSupplierById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "update_supplier", { id: "sup-missing", name: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: supplier sup-missing$/);
    expect(updateSupplier).not.toHaveBeenCalled();
  });

  it("dispatches the partial fields to updateSupplier", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_supplier", {
      id: "sup-1",
      notes: "preferred partner",
    });
    expect(updateSupplier).toHaveBeenCalledWith("sup-1", { notes: "preferred partner" });
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("sup-1");
  });
});

describe("delete_supplier", () => {
  it("returns success when the data layer reports ok", async () => {
    const client = await bootClient();
    const result = await callTool(client, "delete_supplier", { id: "sup-1" });

    expect(getSupplierById).toHaveBeenCalledWith("sup-1");
    expect(softDeleteSupplier).toHaveBeenCalledWith("sup-1", undefined);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("maps the reference-count business signal to a static mcpError", async () => {
    softDeleteSupplier.mockResolvedValueOnce({ ok: false, itemCount: 4 });
    const client = await bootClient();
    const result = await callTool(client, "delete_supplier", { id: "sup-1" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      "Supplier is referenced by 4 item(s). Use force=true to delete anyway."
    );
    // No leaked business text from elsewhere.
    expect(JSON.stringify(result)).not.toContain("itemCount");
  });

  it("passes force=true and proceeds when ok", async () => {
    softDeleteSupplier.mockResolvedValueOnce({ ok: true });
    const client = await bootClient();
    const result = await callTool(client, "delete_supplier", { id: "sup-1", force: true });

    expect(softDeleteSupplier).toHaveBeenCalledWith("sup-1", true);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("maps null precheck to NOT_FOUND: supplier <id>", async () => {
    getSupplierById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "delete_supplier", { id: "sup-missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: supplier sup-missing$/);
    expect(softDeleteSupplier).not.toHaveBeenCalled();
  });
});

describe("restore_supplier", () => {
  it("dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "restore_supplier", { id: "sup-1" });

    expect(restoreSupplier).toHaveBeenCalledWith("sup-1");
    expect(parseToolText(result)).toEqual({ success: true });
  });
});
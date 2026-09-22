import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createPackingItem = vi.fn();
const updatePackingItem = vi.fn();
const deletePackingItem = vi.fn();

vi.mock("@/lib/data", () => ({
  createPackingItem,
  updatePackingItem,
  deletePackingItem,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerPackingTools } = await import("@/lib/mcp/tools/packing");
  const server = new McpServer({ name: "test-packing", version: "0.0.0" });
  registerPackingTools(server);

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
  createPackingItem.mockReset();
  updatePackingItem.mockReset();
  deletePackingItem.mockReset();
}

beforeEach(() => {
  resetMocks();
  createPackingItem.mockImplementation(async (input) => ({ id: "pack-new", ...input }));
  updatePackingItem.mockImplementation(async (id, input) => ({ id, ...input }));
  deletePackingItem.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("add_packing_item", () => {
  it("dispatches and returns the new item", async () => {
    const client = await bootClient();
    const result = await callTool(client, "add_packing_item", {
      tripId: "trip-1",
      label: "Passport",
      sortOrder: 0,
    });
    expect(createPackingItem).toHaveBeenCalledWith({
      tripId: "trip-1",
      label: "Passport",
      sortOrder: 0,
    });
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("pack-new");
  });

  it("rejects empty label", async () => {
    const client = await bootClient();
    const result = await callTool(client, "add_packing_item", { tripId: "trip-1", label: "" });
    expect(result.isError).toBe(true);
    expect(createPackingItem).not.toHaveBeenCalled();
  });
});

describe("update_packing_item", () => {
  it("dispatches partial fields including `checked`", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_packing_item", {
      id: "pack-1",
      label: "Passport copy",
      checked: true,
    });
    expect(updatePackingItem).toHaveBeenCalledWith("pack-1", {
      label: "Passport copy",
      checked: true,
    });
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("pack-1");
  });

  it("catches 'no encontrado' throw → NOT_FOUND: packing item <id>", async () => {
    updatePackingItem.mockRejectedValueOnce(new Error("Item de equipaje no encontrado"));
    const client = await bootClient();
    const result = await callTool(client, "update_packing_item", {
      id: "pack-missing",
      label: "x",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: packing item pack-missing$/);
  });
});

describe("delete_packing_item", () => {
  it("dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "delete_packing_item", { id: "pack-1" });
    expect(deletePackingItem).toHaveBeenCalledWith("pack-1");
    expect(parseToolText(result)).toEqual({ success: true });
  });
});
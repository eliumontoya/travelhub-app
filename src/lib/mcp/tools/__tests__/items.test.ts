import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createItem = vi.fn();
const updateItem = vi.fn();
const deleteItem = vi.fn();
const restoreItem = vi.fn();
const moveItemToDay = vi.fn();
const getItemById = vi.fn();
const duplicateItem = vi.fn();
const reorderItems = vi.fn();

vi.mock("@/lib/data", () => ({
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  moveItemToDay,
  getItemById,
  duplicateItem,
  reorderItems,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerItemTools } = await import("@/lib/mcp/tools/items");
  const server = new McpServer({ name: "test-items", version: "0.0.0" });
  registerItemTools(server);

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
  createItem.mockReset();
  updateItem.mockReset();
  deleteItem.mockReset();
  restoreItem.mockReset();
  moveItemToDay.mockReset();
  getItemById.mockReset();
  duplicateItem.mockReset();
  reorderItems.mockReset();
}

beforeEach(() => {
  resetMocks();
  createItem.mockImplementation(async (input) => ({ id: "item-new", ...input }));
  updateItem.mockImplementation(async (id, input) => ({ id, ...input }));
  deleteItem.mockResolvedValue(undefined);
  restoreItem.mockResolvedValue(undefined);
  moveItemToDay.mockResolvedValue(undefined);
  getItemById.mockResolvedValue({ id: "item-1", tripDayId: "day-1", title: "Source" });
  duplicateItem.mockImplementation(async (itemId, destDayId) => ({
    id: "item-dup",
    tripDayId: destDayId,
    sourceItemId: itemId,
  }));
  reorderItems.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("add_item", () => {
  it("dispatches to createItem with the supplied input", async () => {
    const client = await bootClient();
    const result = await callTool(client, "add_item", {
      tripDayId: "day-1",
      type: "flight",
      title: "AF123 CDG→BCN",
      startTime: "08:00",
      endTime: "10:00",
      location: "CDG",
      lat: 49.0,
      lng: 2.5,
      cost: 199.99,
      supplierId: "sup-1",
      metadata: { airline: "AF" },
    });

    expect(createItem).toHaveBeenCalledWith({
      tripDayId: "day-1",
      type: "flight",
      title: "AF123 CDG→BCN",
      startTime: "08:00",
      endTime: "10:00",
      location: "CDG",
      lat: 49.0,
      lng: 2.5,
      cost: 199.99,
      supplierId: "sup-1",
      metadata: { airline: "AF" },
    });
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("item-new");
  });

  it("rejects unsupported type at schema validation", async () => {
    const client = await bootClient();
    const result = await callTool(client, "add_item", {
      tripDayId: "day-1",
      type: "spaceship",
      title: "x",
    });
    expect(result.isError).toBe(true);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("rejects missing title", async () => {
    const client = await bootClient();
    const result = await callTool(client, "add_item", {
      tripDayId: "day-1",
      type: "hotel",
    });
    expect(result.isError).toBe(true);
    expect(createItem).not.toHaveBeenCalled();
  });
});

describe("update_item", () => {
  it("dispatches partial fields", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_item", {
      id: "item-1",
      title: "Renamed",
      cost: 250,
    });
    expect(updateItem).toHaveBeenCalledWith("item-1", { title: "Renamed", cost: 250 });
    const payload = parseToolText(result) as { id: string; title: string };
    expect(payload.title).toBe("Renamed");
  });

  it("catches 'no encontrado' throw → NOT_FOUND: item <id>", async () => {
    updateItem.mockRejectedValueOnce(new Error("Item no encontrado"));
    const client = await bootClient();
    const result = await callTool(client, "update_item", { id: "item-missing", title: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: item item-missing$/);
  });

  it("sanitizes unexpected throws", async () => {
    updateItem.mockRejectedValueOnce(new Error("DB crashed at 10.0.0.5"));
    const client = await bootClient();
    const result = await callTool(client, "update_item", { id: "item-1", title: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("DB crashed");
  });
});

describe("delete_item / restore_item", () => {
  it("delete_item dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "delete_item", { id: "item-1" });
    expect(deleteItem).toHaveBeenCalledWith("item-1");
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("restore_item dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "restore_item", { id: "item-1" });
    expect(restoreItem).toHaveBeenCalledWith("item-1");
    expect(parseToolText(result)).toEqual({ success: true });
  });
});

describe("move_item", () => {
  it("dispatches to moveItemToDay with itemId and targetDayId", async () => {
    const client = await bootClient();
    const result = await callTool(client, "move_item", {
      itemId: "item-1",
      targetDayId: "day-2",
    });
    expect(moveItemToDay).toHaveBeenCalledWith("item-1", "day-2");
    expect(parseToolText(result)).toEqual({ success: true });
  });
});

describe("duplicate_item", () => {
  it("uses the supplied targetDayId directly", async () => {
    const client = await bootClient();
    const result = await callTool(client, "duplicate_item", {
      itemId: "item-1",
      targetDayId: "day-2",
    });

    expect(getItemById).not.toHaveBeenCalled();
    expect(duplicateItem).toHaveBeenCalledWith("item-1", "day-2");
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("item-dup");
  });

  it("falls back to source tripDayId when targetDayId is omitted", async () => {
    const client = await bootClient();
    const result = await callTool(client, "duplicate_item", { itemId: "item-1" });

    expect(getItemById).toHaveBeenCalledWith("item-1");
    expect(duplicateItem).toHaveBeenCalledWith("item-1", "day-1");
    expect(parseToolText(result)).toEqual(expect.objectContaining({ id: "item-dup" }));
  });

  it("maps getItemById null → NOT_FOUND: item <id>", async () => {
    getItemById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "duplicate_item", { itemId: "item-missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: item item-missing$/);
    expect(duplicateItem).not.toHaveBeenCalled();
  });

  it("catches 'no encontrado' throw → NOT_FOUND: item <id>", async () => {
    duplicateItem.mockRejectedValueOnce(new Error("Item no encontrado"));
    const client = await bootClient();
    const result = await callTool(client, "duplicate_item", {
      itemId: "item-1",
      targetDayId: "day-2",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: item item-1$/);
  });
});

describe("reorder_items", () => {
  it("dispatches the order array", async () => {
    const client = await bootClient();
    const result = await callTool(client, "reorder_items", {
      order: [
        { id: "item-1", sortOrder: 2 },
        { id: "item-2", sortOrder: 1 },
      ],
    });
    expect(reorderItems).toHaveBeenCalledWith([
      { id: "item-1", sortOrder: 2 },
      { id: "item-2", sortOrder: 1 },
    ]);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("rejects an empty order array", async () => {
    const client = await bootClient();
    const result = await callTool(client, "reorder_items", { order: [] });
    expect(result.isError).toBe(true);
    expect(reorderItems).not.toHaveBeenCalled();
  });
});
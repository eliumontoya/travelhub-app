import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Data-layer mocks — every assertion depends on these.
const getClients = vi.fn();
const getClientById = vi.fn();
const createClient = vi.fn();
const updateClient = vi.fn();
const getClientTags = vi.fn();
const setClientTags = vi.fn();
const getTripsByClientId = vi.fn();
const getClientTripSummary = vi.fn();

vi.mock("@/lib/data", () => ({
  getClients,
  getClientById,
  createClient,
  updateClient,
  getClientTags,
  setClientTags,
  getTripsByClientId,
  getClientTripSummary,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerClientTools } = await import("@/lib/mcp/tools/clients");
  const server = new McpServer({ name: "test-clients", version: "0.0.0" });
  registerClientTools(server);

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
  getClients.mockReset();
  getClientById.mockReset();
  createClient.mockReset();
  updateClient.mockReset();
  getClientTags.mockReset();
  setClientTags.mockReset();
  getTripsByClientId.mockReset();
  getClientTripSummary.mockReset();
}

beforeEach(() => {
  resetMocks();
  // Default successful returns so happy-path tests are terse.
  getClients.mockResolvedValue({
    items: [{ id: "c-1", name: "Alice" }],
    totalCount: 1,
  });
  getClientById.mockResolvedValue({ id: "c-1", name: "Alice" });
  createClient.mockImplementation(async (input) => ({
    id: "c-new",
    name: input.name,
  }));
  updateClient.mockImplementation(async (id, input) => ({
    id,
    ...input,
  }));
  getClientTags.mockResolvedValue([{ id: "t-1", name: "VIP" }]);
  setClientTags.mockResolvedValue(undefined);
  getTripsByClientId.mockResolvedValue([{ id: "trip-1", title: "Paris" }]);
  getClientTripSummary.mockResolvedValue({
    totalTrips: 1,
    publishedCount: 1,
    draftCount: 0,
    archivedCount: 0,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("list_clients", () => {
  it("dispatches to getClients with the supplied pagination args", async () => {
    const client = await bootClient();
    const result = await callTool(client, "list_clients", { page: 2, pageSize: 25 });

    expect(getClients).toHaveBeenCalledWith({ page: 2, pageSize: 25 });
    const payload = parseToolText(result) as { items: Array<{ id: string }>; totalCount: number };
    expect(payload.totalCount).toBe(1);
    expect(payload.items[0].id).toBe("c-1");
  });

  it("supports omitted pagination (defaults to empty params)", async () => {
    const client = await bootClient();
    await callTool(client, "list_clients", {});
    expect(getClients).toHaveBeenCalledWith({});
  });

  it("maps unexpected errors without leaking internals", async () => {
    getClients.mockRejectedValueOnce(new Error("DB crashed at 10.0.0.5"));
    const client = await bootClient();
    const result = await callTool(client, "list_clients", {});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("DB crashed");
    expect(JSON.stringify(result)).not.toContain("10.0.0.5");
  });
});

describe("get_client", () => {
  it("returns the client when found", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_client", { id: "c-1" });

    expect(getClientById).toHaveBeenCalledWith("c-1");
    const payload = parseToolText(result) as { id: string; name: string };
    expect(payload.id).toBe("c-1");
    expect(payload.name).toBe("Alice");
  });

  it("maps null to NOT_FOUND: client <id>", async () => {
    getClientById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "get_client", { id: "c-missing" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: client c-missing$/);
  });

  it("rejects an empty id at schema validation", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_client", { id: "" });
    expect(result.isError).toBe(true);
    expect(getClientById).not.toHaveBeenCalled();
  });
});

describe("create_client", () => {
  it("dispatches to createClient with the supplied input", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_client", {
      name: "Bob",
      email: "bob@example.com",
      phone: "+1-555-0100",
    });

    expect(createClient).toHaveBeenCalledWith({
      name: "Bob",
      email: "bob@example.com",
      phone: "+1-555-0100",
    });
    const payload = parseToolText(result) as { id: string; name: string };
    expect(payload.id).toBe("c-new");
    expect(payload.name).toBe("Bob");
  });

  it("rejects empty name at schema validation", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_client", { name: "" });
    expect(result.isError).toBe(true);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rejects invalid email format", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_client", {
      name: "Bob",
      email: "not-an-email",
    });
    expect(result.isError).toBe(true);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected throws", async () => {
    createClient.mockRejectedValueOnce(new Error("duplicate slug"));
    const client = await bootClient();
    const result = await callTool(client, "create_client", { name: "Bob" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("duplicate slug");
  });
});

describe("update_client", () => {
  it("dispatches to updateClient with the partial fields", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_client", {
      id: "c-1",
      name: "Alice 2",
      notes: "VIP",
    });

    expect(getClientById).toHaveBeenCalledWith("c-1");
    expect(updateClient).toHaveBeenCalledWith(
      "c-1",
      expect.objectContaining({ name: "Alice 2", notes: "VIP" })
    );
    expect((parseToolText(result) as { name: string }).name).toBe("Alice 2");
  });

  it("maps null precheck to NOT_FOUND: client <id>", async () => {
    getClientById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "update_client", { id: "c-missing", name: "x" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: client c-missing$/);
    expect(updateClient).not.toHaveBeenCalled();
  });
});

describe("get_client_tags", () => {
  it("dispatches to getClientTags and returns the tag list", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_client_tags", { clientId: "c-1" });

    expect(getClientTags).toHaveBeenCalledWith("c-1");
    const payload = parseToolText(result) as Array<{ id: string }>;
    expect(payload[0].id).toBe("t-1");
  });

  it("returns an empty list when the client has no tags", async () => {
    getClientTags.mockResolvedValueOnce([]);
    const client = await bootClient();
    const result = await callTool(client, "get_client_tags", { clientId: "c-1" });
    expect(parseToolText(result)).toEqual([]);
  });
});

describe("set_client_tags", () => {
  it("dispatches to setClientTags and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "set_client_tags", {
      clientId: "c-1",
      tagIds: ["t-1", "t-2"],
    });

    expect(setClientTags).toHaveBeenCalledWith("c-1", ["t-1", "t-2"]);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("accepts an empty tagIds array (clear-all semantics)", async () => {
    const client = await bootClient();
    const result = await callTool(client, "set_client_tags", {
      clientId: "c-1",
      tagIds: [],
    });

    expect(setClientTags).toHaveBeenCalledWith("c-1", []);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("rejects empty tag id entries", async () => {
    const client = await bootClient();
    const result = await callTool(client, "set_client_tags", {
      clientId: "c-1",
      tagIds: ["t-1", ""],
    });
    expect(result.isError).toBe(true);
    expect(setClientTags).not.toHaveBeenCalled();
  });
});

describe("get_client_trips", () => {
  it("dispatches both data calls in parallel and returns {trips, summary}", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_client_trips", { clientId: "c-1" });

    expect(getTripsByClientId).toHaveBeenCalledWith("c-1");
    expect(getClientTripSummary).toHaveBeenCalledWith("c-1");
    const payload = parseToolText(result) as {
      trips: Array<{ id: string }>;
      summary: { totalTrips: number; publishedCount: number };
    };
    expect(payload.trips[0].id).toBe("trip-1");
    expect(payload.summary.totalTrips).toBe(1);
    expect(payload.summary.publishedCount).toBe(1);
  });

  it("returns an empty trips list when the client has none", async () => {
    getTripsByClientId.mockResolvedValueOnce([]);
    getClientTripSummary.mockResolvedValueOnce({
      totalTrips: 0,
      publishedCount: 0,
      draftCount: 0,
      archivedCount: 0,
    });
    const client = await bootClient();
    const result = await callTool(client, "get_client_trips", { clientId: "c-1" });
    const payload = parseToolText(result) as {
      trips: unknown[];
      summary: { totalTrips: number };
    };
    expect(payload.trips).toEqual([]);
    expect(payload.summary.totalTrips).toBe(0);
  });
});
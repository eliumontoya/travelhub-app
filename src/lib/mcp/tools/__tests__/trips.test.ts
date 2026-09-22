import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Data-layer mocks.
const getTripsWithClients = vi.fn();
const getTripById = vi.fn();
const createTrip = vi.fn();
const createTripFromTemplate = vi.fn();
const updateTrip = vi.fn();
const setTripClients = vi.fn();
const setTripTags = vi.fn();
const saveTripAsTemplate = vi.fn();
const getTemplates = vi.fn();

vi.mock("@/lib/data", () => ({
  getTripsWithClients,
  getTripById,
  createTrip,
  createTripFromTemplate,
  updateTrip,
  setTripClients,
  setTripTags,
  saveTripAsTemplate,
  getTemplates,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerTripTools } = await import("@/lib/mcp/tools/trips");
  const server = new McpServer({ name: "test-trips", version: "0.0.0" });
  registerTripTools(server);

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
  getTripsWithClients.mockReset();
  getTripById.mockReset();
  createTrip.mockReset();
  createTripFromTemplate.mockReset();
  updateTrip.mockReset();
  setTripClients.mockReset();
  setTripTags.mockReset();
  saveTripAsTemplate.mockReset();
  getTemplates.mockReset();
}

beforeEach(() => {
  resetMocks();
  getTripsWithClients.mockResolvedValue({
    items: [{ id: "trip-1", title: "Paris" }],
    totalCount: 1,
  });
  getTripById.mockResolvedValue({ id: "trip-1", title: "Paris" });
  createTrip.mockImplementation(async (input) => ({
    id: "trip-new",
    ...input,
  }));
  createTripFromTemplate.mockImplementation(async (_templateId, input) => ({
    id: "trip-from-tpl",
    ...input,
  }));
  updateTrip.mockImplementation(async (id, input) => ({ id, ...input }));
  setTripClients.mockResolvedValue(undefined);
  setTripTags.mockResolvedValue(undefined);
  saveTripAsTemplate.mockResolvedValue({ id: "tpl-1", title: "Template" });
  getTemplates.mockResolvedValue([{ id: "tpl-1", title: "Template" }]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("list_trips", () => {
  it("maps scalar filters to the array shape and passes them through", async () => {
    const client = await bootClient();
    const result = await callTool(client, "list_trips", {
      page: 1,
      pageSize: 25,
      query: "paris",
      status: "draft",
      currency: "USD",
      clientId: "c-1",
      tagId: "t-1",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
    });

    expect(getTripsWithClients).toHaveBeenCalledWith({
      page: 1,
      pageSize: 25,
      filters: {
        query: "paris",
        status: ["draft"],
        currency: "USD",
        clientIds: ["c-1"],
        tagIds: ["t-1"],
        dateFrom: "2026-01-01",
        dateTo: "2026-12-31",
      },
    });
    const payload = parseToolText(result) as { items: Array<{ id: string }> };
    expect(payload.items[0].id).toBe("trip-1");
  });

  it("omits undefined filter values", async () => {
    const client = await bootClient();
    await callTool(client, "list_trips", { page: 1 });
    expect(getTripsWithClients).toHaveBeenCalledWith({
      page: 1,
      filters: {
        query: undefined,
        status: undefined,
        currency: undefined,
        clientIds: undefined,
        tagIds: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      },
    });
  });

  it("rejects invalid currency", async () => {
    const client = await bootClient();
    const result = await callTool(client, "list_trips", { currency: "GBP" });
    expect(result.isError).toBe(true);
  });
});

describe("get_trip", () => {
  it("returns the trip when found", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_trip", { id: "trip-1" });
    expect(getTripById).toHaveBeenCalledWith("trip-1");
    expect((parseToolText(result) as { id: string }).id).toBe("trip-1");
  });

  it("maps null to NOT_FOUND: trip <id>", async () => {
    getTripById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "get_trip", { id: "trip-missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-missing$/);
  });
});

describe("create_trip", () => {
  it("generates a slug from the title before calling createTrip", async () => {
    const client = await bootClient();
    await callTool(client, "create_trip", {
      clientIds: ["c-1"],
      title: "Paris Adventure",
    });

    expect(createTrip).toHaveBeenCalledTimes(1);
    const [input] = createTrip.mock.calls[0];
    expect(input.title).toBe("Paris Adventure");
    expect(input.clientIds).toEqual(["c-1"]);
    expect(input.slug).toMatch(/^paris-adventure-[a-z0-9]+$/);
  });

  it("falls back to 'viaje' for unsluggable titles", async () => {
    const client = await bootClient();
    await callTool(client, "create_trip", {
      clientIds: ["c-1"],
      title: "###",
    });
    const [input] = createTrip.mock.calls[0];
    expect(input.slug).toMatch(/^viaje-[a-z0-9]+$/);
  });

  it("rejects empty clientIds at schema validation", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_trip", {
      clientIds: [],
      title: "Paris Adventure",
    });
    expect(result.isError).toBe(true);
    expect(createTrip).not.toHaveBeenCalled();
  });

  it("rejects missing title", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_trip", { clientIds: ["c-1"] });
    expect(result.isError).toBe(true);
    expect(createTrip).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected throws", async () => {
    createTrip.mockRejectedValueOnce(new Error("RLS denied"));
    const client = await bootClient();
    const result = await callTool(client, "create_trip", {
      clientIds: ["c-1"],
      title: "Paris",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("RLS");
  });
});

describe("create_trip_from_template", () => {
  it("uses the supplied title and generates a slug", async () => {
    const client = await bootClient();
    await callTool(client, "create_trip_from_template", {
      templateId: "tpl-1",
      title: "Paris Copy",
      clientIds: ["c-1"],
    });

    expect(getTripById).toHaveBeenCalledWith("tpl-1");
    expect(createTripFromTemplate).toHaveBeenCalledTimes(1);
    const [templateId, input] = createTripFromTemplate.mock.calls[0];
    expect(templateId).toBe("tpl-1");
    expect(input.title).toBe("Paris Copy");
    expect(input.clientIds).toEqual(["c-1"]);
    expect(input.slug).toMatch(/^paris-copy-[a-z0-9]+$/);
  });

  it("falls back to the template title when title is omitted", async () => {
    getTripById.mockResolvedValueOnce({ id: "tpl-1", title: "Original Template" });
    const client = await bootClient();
    await callTool(client, "create_trip_from_template", {
      templateId: "tpl-1",
      clientIds: ["c-1"],
    });
    const [, input] = createTripFromTemplate.mock.calls[0];
    expect(input.title).toBe("Original Template");
    expect(input.slug).toMatch(/^original-template-[a-z0-9]+$/);
  });

  it("maps missing template to NOT_FOUND: template <id>", async () => {
    getTripById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "create_trip_from_template", {
      templateId: "tpl-missing",
      clientIds: ["c-1"],
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: template tpl-missing$/);
    expect(createTripFromTemplate).not.toHaveBeenCalled();
  });

  it("rejects empty clientIds at schema validation", async () => {
    const client = await bootClient();
    const result = await callTool(client, "create_trip_from_template", {
      templateId: "tpl-1",
      clientIds: [],
    });
    expect(result.isError).toBe(true);
    expect(createTripFromTemplate).not.toHaveBeenCalled();
  });
});

describe("update_trip", () => {
  it("precheck null → NOT_FOUND: trip <id>", async () => {
    getTripById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "update_trip", { id: "trip-missing", title: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-missing$/);
    expect(updateTrip).not.toHaveBeenCalled();
  });

  it("dispatches the partial fields", async () => {
    const client = await bootClient();
    await callTool(client, "update_trip", {
      id: "trip-1",
      title: "Paris 2",
      status: "published",
      budget: 1234.5,
    });
    expect(updateTrip).toHaveBeenCalledWith("trip-1", {
      title: "Paris 2",
      status: "published",
      budget: 1234.5,
    });
  });
});

describe("set_trip_clients", () => {
  it("dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "set_trip_clients", {
      tripId: "trip-1",
      clientIds: ["c-1", "c-2"],
    });
    expect(setTripClients).toHaveBeenCalledWith("trip-1", ["c-1", "c-2"]);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("rejects empty clientIds (schema-level invariant)", async () => {
    const client = await bootClient();
    const result = await callTool(client, "set_trip_clients", {
      tripId: "trip-1",
      clientIds: [],
    });
    expect(result.isError).toBe(true);
    expect(setTripClients).not.toHaveBeenCalled();
  });
});

describe("set_trip_tags", () => {
  it("dispatches and returns success (empty array clears all)", async () => {
    const client = await bootClient();
    const result = await callTool(client, "set_trip_tags", {
      tripId: "trip-1",
      tagIds: [],
    });
    expect(setTripTags).toHaveBeenCalledWith("trip-1", []);
    expect(parseToolText(result)).toEqual({ success: true });
  });
});

describe("save_trip_as_template", () => {
  it("precheck null → NOT_FOUND: trip <id>", async () => {
    getTripById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "save_trip_as_template", {
      tripId: "trip-missing",
      title: "T",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-missing$/);
    expect(saveTripAsTemplate).not.toHaveBeenCalled();
  });

  it("catches throw with 'no encontrado' → NOT_FOUND: trip <id>", async () => {
    saveTripAsTemplate.mockRejectedValueOnce(new Error("Viaje no encontrado"));
    const client = await bootClient();
    const result = await callTool(client, "save_trip_as_template", {
      tripId: "trip-1",
      title: "Template",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-1$/);
  });

  it("dispatches and returns the new template", async () => {
    const client = await bootClient();
    const result = await callTool(client, "save_trip_as_template", {
      tripId: "trip-1",
      title: "My Template",
    });
    expect(saveTripAsTemplate).toHaveBeenCalledWith("trip-1", "My Template");
    const payload = parseToolText(result) as { id: string; title: string };
    expect(payload.title).toBe("Template");
  });
});

describe("list_templates", () => {
  it("dispatches and returns the templates array", async () => {
    const client = await bootClient();
    const result = await callTool(client, "list_templates", {});
    expect(getTemplates).toHaveBeenCalled();
    const payload = parseToolText(result) as Array<{ id: string }>;
    expect(payload[0].id).toBe("tpl-1");
  });
});
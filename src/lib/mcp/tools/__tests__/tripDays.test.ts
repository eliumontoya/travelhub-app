import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createTripDay = vi.fn();
const updateTripDay = vi.fn();
const deleteTripDay = vi.fn();
const restoreTripDay = vi.fn();
const generateTripDays = vi.fn();
const reorderTripDays = vi.fn();

vi.mock("@/lib/data", () => ({
  createTripDay,
  updateTripDay,
  deleteTripDay,
  restoreTripDay,
  generateTripDays,
  reorderTripDays,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerTripDayTools } = await import("@/lib/mcp/tools/tripDays");
  const server = new McpServer({ name: "test-tripdays", version: "0.0.0" });
  registerTripDayTools(server);

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
  createTripDay.mockReset();
  updateTripDay.mockReset();
  deleteTripDay.mockReset();
  restoreTripDay.mockReset();
  generateTripDays.mockReset();
  reorderTripDays.mockReset();
}

beforeEach(() => {
  resetMocks();
  createTripDay.mockImplementation(async (input) => ({ id: "day-new", ...input }));
  updateTripDay.mockImplementation(async (id, input) => ({ id, ...input }));
  deleteTripDay.mockResolvedValue(undefined);
  restoreTripDay.mockResolvedValue(undefined);
  generateTripDays.mockResolvedValue({ created: 3, totalDays: 3 });
  reorderTripDays.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("add_trip_day", () => {
  it("dispatches to createTripDay with the supplied input", async () => {
    const client = await bootClient();
    const result = await callTool(client, "add_trip_day", {
      tripId: "trip-1",
      date: "2026-06-01",
      notes: "arrival",
      sortOrder: 0,
    });
    expect(createTripDay).toHaveBeenCalledWith({
      tripId: "trip-1",
      date: "2026-06-01",
      notes: "arrival",
      sortOrder: 0,
    });
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("day-new");
  });
});

describe("update_trip_day", () => {
  it("dispatches partial fields", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_trip_day", {
      id: "day-1",
      notes: "updated",
      sortOrder: 2,
    });
    expect(updateTripDay).toHaveBeenCalledWith("day-1", {
      notes: "updated",
      sortOrder: 2,
    });
    const payload = parseToolText(result) as { id: string };
    expect(payload.id).toBe("day-1");
  });

  it("catches 'no encontrado' throw → NOT_FOUND: trip day <id>", async () => {
    updateTripDay.mockRejectedValueOnce(new Error("Día de viaje no encontrado"));
    const client = await bootClient();
    const result = await callTool(client, "update_trip_day", { id: "day-missing", notes: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip day day-missing$/);
  });

  it("sanitizes unexpected throws", async () => {
    updateTripDay.mockRejectedValueOnce(new Error("DB crashed at 10.0.0.5"));
    const client = await bootClient();
    const result = await callTool(client, "update_trip_day", { id: "day-1", notes: "x" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("DB crashed");
  });
});

describe("delete_trip_day", () => {
  it("dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "delete_trip_day", { id: "day-1" });
    expect(deleteTripDay).toHaveBeenCalledWith("day-1");
    expect(parseToolText(result)).toEqual({ success: true });
  });
});

describe("restore_trip_day", () => {
  it("dispatches and returns success", async () => {
    const client = await bootClient();
    const result = await callTool(client, "restore_trip_day", { id: "day-1" });
    expect(restoreTripDay).toHaveBeenCalledWith("day-1");
    expect(parseToolText(result)).toEqual({ success: true });
  });
});

describe("generate_trip_days", () => {
  it("dispatches and returns {created, totalDays}", async () => {
    const client = await bootClient();
    const result = await callTool(client, "generate_trip_days", { tripId: "trip-1" });
    expect(generateTripDays).toHaveBeenCalledWith("trip-1");
    const payload = parseToolText(result) as { created: number; totalDays: number };
    expect(payload.created).toBe(3);
    expect(payload.totalDays).toBe(3);
  });

  it("catches 'no encontrado' throw → NOT_FOUND: trip <id>", async () => {
    generateTripDays.mockRejectedValueOnce(new Error("Viaje no encontrado"));
    const client = await bootClient();
    const result = await callTool(client, "generate_trip_days", { tripId: "trip-missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-missing$/);
  });
});

describe("reorder_trip_days", () => {
  it("dispatches the order array", async () => {
    const client = await bootClient();
    const result = await callTool(client, "reorder_trip_days", {
      order: [
        { id: "day-1", sortOrder: 1 },
        { id: "day-2", sortOrder: 0 },
      ],
    });
    expect(reorderTripDays).toHaveBeenCalledWith([
      { id: "day-1", sortOrder: 1 },
      { id: "day-2", sortOrder: 0 },
    ]);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("rejects an empty order array", async () => {
    const client = await bootClient();
    const result = await callTool(client, "reorder_trip_days", { order: [] });
    expect(result.isError).toBe(true);
    expect(reorderTripDays).not.toHaveBeenCalled();
  });
});
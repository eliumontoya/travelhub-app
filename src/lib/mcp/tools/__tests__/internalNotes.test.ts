import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getTripById = vi.fn();
const getTripInternalNotes = vi.fn();
const updateTripInternalNotes = vi.fn();

vi.mock("@/lib/data", () => ({
  getTripById,
  getTripInternalNotes,
  updateTripInternalNotes,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerInternalNoteTools } = await import("@/lib/mcp/tools/internalNotes");
  const server = new McpServer({ name: "test-internal-notes", version: "0.0.0" });
  registerInternalNoteTools(server);

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
  getTripById.mockReset();
  getTripInternalNotes.mockReset();
  updateTripInternalNotes.mockReset();
}

beforeEach(() => {
  resetMocks();
  getTripById.mockResolvedValue({ id: "trip-1", title: "Paris" });
  getTripInternalNotes.mockResolvedValue("agent-only notes");
  updateTripInternalNotes.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("get_trip_internal_notes", () => {
  it("returns { internalNotes } for an existing trip", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_trip_internal_notes", { id: "trip-1" });
    expect(getTripById).toHaveBeenCalledWith("trip-1");
    expect(getTripInternalNotes).toHaveBeenCalledWith("trip-1");
    expect(parseToolText(result)).toEqual({ internalNotes: "agent-only notes" });
  });

  it("returns { internalNotes: null } when notes are empty", async () => {
    getTripInternalNotes.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "get_trip_internal_notes", { id: "trip-1" });
    expect(parseToolText(result)).toEqual({ internalNotes: null });
  });

  it("maps null precheck → NOT_FOUND: trip <id>", async () => {
    getTripById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "get_trip_internal_notes", { id: "trip-missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-missing$/);
    expect(getTripInternalNotes).not.toHaveBeenCalled();
  });
});

describe("update_trip_internal_notes", () => {
  it("dispatches and returns success for a non-null string", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_trip_internal_notes", {
      id: "trip-1",
      internalNotes: "updated notes",
    });
    expect(getTripById).toHaveBeenCalledWith("trip-1");
    expect(updateTripInternalNotes).toHaveBeenCalledWith("trip-1", "updated notes");
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("accepts null (clear notes)", async () => {
    const client = await bootClient();
    const result = await callTool(client, "update_trip_internal_notes", {
      id: "trip-1",
      internalNotes: null,
    });
    expect(updateTripInternalNotes).toHaveBeenCalledWith("trip-1", null);
    expect(parseToolText(result)).toEqual({ success: true });
  });

  it("maps null precheck → NOT_FOUND: trip <id>", async () => {
    getTripById.mockResolvedValueOnce(null);
    const client = await bootClient();
    const result = await callTool(client, "update_trip_internal_notes", {
      id: "trip-missing",
      internalNotes: "x",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: trip trip-missing$/);
    expect(updateTripInternalNotes).not.toHaveBeenCalled();
  });
});
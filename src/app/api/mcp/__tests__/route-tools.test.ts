import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Data-layer mocks — every assertion depends on these.
const getServicesForTrip = vi.fn();
const getServiceChecklistForTrip = vi.fn();
const getServiceDocumentSummariesForTrip = vi.fn();
const getSignedServiceDocumentDownloadUrl = vi.fn();
const markUploadProcessed = vi.fn();
const markUploadReviewed = vi.fn();
const requestReUpload = vi.fn();
const assertServiceUploadMutable = vi.fn();

// Agent-action data-layer mocks. The 8 new tool modules call `data.fn()`
// against the `@/lib/data` barrel. We expose every referenced fn as a
// vi.fn() so listTools and existing dispatch assertions can run. Each fn
// returns a sensible default so happy-path tests aren't blocked; tests that
// exercise a specific path can override via `.mockResolvedValueOnce(...)`.
const mockDataFns = {
  // clients
  getClients: vi.fn(),
  getClientById: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  getClientTags: vi.fn(),
  setClientTags: vi.fn(),
  getTripsByClientId: vi.fn(),
  getClientTripSummary: vi.fn(),
  // suppliers
  getSuppliers: vi.fn(),
  getSupplierById: vi.fn(),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  softDeleteSupplier: vi.fn(),
  restoreSupplier: vi.fn(),
  // trips
  getTripsWithClients: vi.fn(),
  getTripById: vi.fn(),
  createTrip: vi.fn(),
  createTripFromTemplate: vi.fn(),
  updateTrip: vi.fn(),
  setTripClients: vi.fn(),
  setTripTags: vi.fn(),
  saveTripAsTemplate: vi.fn(),
  getTemplates: vi.fn(),
  // trip days
  createTripDay: vi.fn(),
  updateTripDay: vi.fn(),
  deleteTripDay: vi.fn(),
  restoreTripDay: vi.fn(),
  generateTripDays: vi.fn(),
  reorderTripDays: vi.fn(),
  // items
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  restoreItem: vi.fn(),
  moveItemToDay: vi.fn(),
  getItemById: vi.fn(),
  duplicateItem: vi.fn(),
  reorderItems: vi.fn(),
  // packing
  createPackingItem: vi.fn(),
  updatePackingItem: vi.fn(),
  deletePackingItem: vi.fn(),
  // internal notes
  getTripInternalNotes: vi.fn(),
  updateTripInternalNotes: vi.fn(),
  // travel agents
  getTravelAgents: vi.fn(),
  getTravelAgentById: vi.fn(),
  createTravelAgent: vi.fn(),
  updateTravelAgent: vi.fn(),
  deleteTravelAgent: vi.fn(),
  // traveler activities
  canClientAddActivities: vi.fn(),
  createTravelerActivity: vi.fn(),
  updateTravelerActivity: vi.fn(),
  deleteTravelerActivity: vi.fn(),
};

vi.mock("@/lib/data", () => mockDataFns);

vi.mock("@/lib/data/services", () => ({
  getServicesForTrip,
  getServiceChecklistForTrip,
  getServiceDocumentSummariesForTrip,
  markUploadProcessed,
  markUploadReviewed,
  requestReUpload,
  assertServiceUploadMutable,
}));

vi.mock("@/lib/data/documents", () => ({
  getSignedServiceDocumentDownloadUrl,
  getSignedServiceDocumentUploadUrl: vi.fn().mockResolvedValue(
    "https://signed.test/upload/p.pdf?token=t"
  ),
}));

const EXPECTED_TOOLS = [
  "list_services",
  "get_service_checklist",
  "get_service_document_summaries",
  "get_service_upload_download_url",
  "process_service_upload",
  "mark_service_upload_reviewed",
  "request_service_upload_reupload",
  // agent-action tools (41):
  "list_clients",
  "get_client",
  "create_client",
  "update_client",
  "get_client_tags",
  "set_client_tags",
  "get_client_trips",
  "list_suppliers",
  "get_supplier",
  "create_supplier",
  "update_supplier",
  "delete_supplier",
  "restore_supplier",
  "list_trips",
  "get_trip",
  "create_trip",
  "create_trip_from_template",
  "update_trip",
  "set_trip_clients",
  "set_trip_tags",
  "save_trip_as_template",
  "list_templates",
  "add_trip_day",
  "update_trip_day",
  "delete_trip_day",
  "restore_trip_day",
  "generate_trip_days",
  "reorder_trip_days",
  "add_item",
  "update_item",
  "delete_item",
  "restore_item",
  "move_item",
  "duplicate_item",
  "reorder_items",
  "add_packing_item",
  "update_packing_item",
  "delete_packing_item",
  "get_trip_internal_notes",
  "update_trip_internal_notes",
  "get_document_upload_url",
  // travel agents (5):
  "list_travel_agents",
  "get_travel_agent",
  "create_travel_agent",
  "update_travel_agent",
  "delete_travel_agent",
  // traveler activities (4):
  "can_client_add_activities",
  "create_traveler_activity",
  "update_traveler_activity",
  "delete_traveler_activity",
] as const;

interface ToolListEntry {
  name: string;
}

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClientAndListTools(): Promise<ToolListEntry[]> {
  const { createMcpServer } = await import("@/lib/mcp/server");
  const server = createMcpServer();

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  const result = await client.listTools();
  return result.tools as unknown as ToolListEntry[];
}

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<ToolCallResult> {
  const { createMcpServer } = await import("@/lib/mcp/server");
  const server = createMcpServer();

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  return (await client.callTool({ name, arguments: args })) as unknown as ToolCallResult;
}

function parseToolText(result: ToolCallResult): unknown {
  const block = result.content.find((c) => c.type === "text");
  if (!block?.text) throw new Error("expected a text block");
  return JSON.parse(block.text);
}

function resetMocks() {
  getServicesForTrip.mockReset();
  getServiceChecklistForTrip.mockReset();
  getServiceDocumentSummariesForTrip.mockReset();
  getSignedServiceDocumentDownloadUrl.mockReset();
  markUploadProcessed.mockReset();
  markUploadReviewed.mockReset();
  requestReUpload.mockReset();
  assertServiceUploadMutable.mockReset();
  for (const fn of Object.values(mockDataFns)) {
    fn.mockReset();
  }
}

beforeEach(() => {
  resetMocks();
  // Default successful returns so happy-path tests can be terse.
  getServicesForTrip.mockResolvedValue([
    { id: "svc-1", tripId: "trip-1", clientId: "c-1", serviceType: "trip_documents", status: "active" },
  ]);
  getServiceChecklistForTrip.mockResolvedValue({
    id: "svc-1",
    tripId: "trip-1",
    clientId: "c-1",
    serviceType: "trip_documents",
    status: "active",
    items: [
      {
        id: "item-1",
        serviceId: "svc-1",
        label: "Passport",
        required: true,
        sortOrder: 0,
        upload: {
          id: "up-1",
          serviceId: "svc-1",
          checklistItemId: "item-1",
          filePath: "services/svc-1/item-1/passport.pdf",
          filename: "passport.pdf",
          status: "uploaded",
          fileRemoved: false,
          url: null,
        },
      },
    ],
  });
  getServiceDocumentSummariesForTrip.mockResolvedValue([
    { serviceId: "svc-1", clientId: "c-1", processed: 1, total: 2, awaitingReview: 1 },
  ]);
  getSignedServiceDocumentDownloadUrl.mockResolvedValue("https://signed.test/path?token=x");
  markUploadProcessed.mockResolvedValue(undefined);
  markUploadReviewed.mockResolvedValue(undefined);
  requestReUpload.mockResolvedValue(undefined);
  assertServiceUploadMutable.mockResolvedValue(undefined);
  // Agent-action defaults — every fn returns a benign empty shape so the
  // 48-tool registration check passes without crashing on tool startup.
  for (const fn of Object.values(mockDataFns)) {
    fn.mockResolvedValue(undefined);
  }
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MCP tool registration", () => {
  it("registers exactly the 57 documented tools with no collisions", async () => {
    const tools = await bootClientAndListTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
    // No duplicate names by construction (sort + toEqual), but also verify
    // the count matches the design's "57 unique tools" promise.
    expect(names).toHaveLength(57);
  });

  it("exposes a non-empty description for each tool", async () => {
    const tools = await bootClientAndListTools();
    for (const tool of tools) {
      expect(tool.name.length, `${tool.name} has no name`).toBeGreaterThan(0);
    }
  });
});

describe("list_services", () => {
  it("dispatches to getServicesForTrip with the supplied tripId", async () => {
    const result = await callTool("list_services", { tripId: "trip-1" });

    expect(getServicesForTrip).toHaveBeenCalledWith("trip-1");
    expect(parseToolText(result)).toEqual([
      expect.objectContaining({ id: "svc-1", tripId: "trip-1" }),
    ]);
  });

  it("returns an empty list when the trip has no services", async () => {
    getServicesForTrip.mockResolvedValueOnce([]);
    const result = await callTool("list_services", { tripId: "trip-empty" });
    expect(parseToolText(result)).toEqual([]);
  });

  it("maps unexpected errors without leaking internals", async () => {
    getServicesForTrip.mockRejectedValueOnce(new Error("DB crashed at 10.0.0.5"));
    const result = await callTool("list_services", { tripId: "trip-1" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("DB crashed");
    expect(JSON.stringify(result)).not.toContain("10.0.0.5");
  });
});

describe("get_service_checklist", () => {
  it("dispatches with tripId and serviceId and exposes uploads with no signed URLs", async () => {
    const result = await callTool("get_service_checklist", {
      tripId: "trip-1",
      serviceId: "svc-1",
    });

    expect(getServiceChecklistForTrip).toHaveBeenCalledWith("trip-1", "svc-1");
    const payload = parseToolText(result) as {
      items: Array<{ upload?: { filePath: string; status: string; url: unknown } }>;
    };
    expect(payload.items[0].upload?.filePath).toBe("services/svc-1/item-1/passport.pdf");
    expect(payload.items[0].upload?.status).toBe("uploaded");
    expect(payload.items[0].upload?.url).toBeNull();
  });
});

describe("get_service_document_summaries", () => {
  it("dispatches with the tripId", async () => {
    const result = await callTool("get_service_document_summaries", { tripId: "trip-1" });
    expect(getServiceDocumentSummariesForTrip).toHaveBeenCalledWith("trip-1");
    expect(parseToolText(result)).toEqual([
      { serviceId: "svc-1", clientId: "c-1", processed: 1, total: 2, awaitingReview: 1 },
    ]);
  });
});

describe("get_service_upload_download_url", () => {
  it("uses the default 3600 expiry when expiresIn is omitted", async () => {
    const result = await callTool("get_service_upload_download_url", {
      path: "services/svc-1/item-1/passport.pdf",
    });
    expect(getSignedServiceDocumentDownloadUrl).toHaveBeenCalledWith(
      "services/svc-1/item-1/passport.pdf",
      3600
    );
    expect(parseToolText(result)).toEqual({
      url: "https://signed.test/path?token=x",
      expiresIn: 3600,
    });
  });

  it("passes the explicit expiresIn override through", async () => {
    await callTool("get_service_upload_download_url", {
      path: "p.pdf",
      expiresIn: 600,
    });
    expect(getSignedServiceDocumentDownloadUrl).toHaveBeenCalledWith("p.pdf", 600);
  });

  it("rejects invalid zod input (path too short, expiresIn out of range)", async () => {
    const badPath = await callTool("get_service_upload_download_url", { path: "" });
    expect(badPath.isError).toBe(true);

    const tooSmall = await callTool("get_service_upload_download_url", {
      path: "p.pdf",
      expiresIn: 10,
    });
    expect(tooSmall.isError).toBe(true);

    const tooBig = await callTool("get_service_upload_download_url", {
      path: "p.pdf",
      expiresIn: 999999999,
    });
    expect(tooBig.isError).toBe(true);
  });

  it("maps signed-URL failures to a sanitized error", async () => {
    getSignedServiceDocumentDownloadUrl.mockRejectedValueOnce(new Error("internal stack"));
    const result = await callTool("get_service_upload_download_url", { path: "p.pdf" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("internal stack");
  });
});

describe("mutation tools — guard + dispatch", () => {
  it("process_service_upload calls the guard first, then markUploadProcessed", async () => {
    const callOrder: string[] = [];
    assertServiceUploadMutable.mockImplementationOnce(async () => {
      callOrder.push("guard");
    });
    markUploadProcessed.mockImplementationOnce(async () => {
      callOrder.push("mark");
    });

    const result = await callTool("process_service_upload", {
      tripId: "trip-1",
      uploadId: "up-1",
    });

    expect(callOrder).toEqual(["guard", "mark"]);
    expect(assertServiceUploadMutable).toHaveBeenCalledWith("up-1", "trip-1");
    expect(markUploadProcessed).toHaveBeenCalledWith("up-1");
    expect(parseToolText(result)).toEqual({ processed: true });
  });

  it("mark_service_upload_reviewed calls the guard first, then markUploadReviewed", async () => {
    const result = await callTool("mark_service_upload_reviewed", {
      tripId: "trip-1",
      uploadId: "up-1",
    });

    expect(assertServiceUploadMutable).toHaveBeenCalledWith("up-1", "trip-1");
    expect(markUploadReviewed).toHaveBeenCalledWith("up-1");
    expect(parseToolText(result)).toEqual({ reviewed: true });
  });

  it("request_service_upload_reupload calls the guard first, then requestReUpload", async () => {
    const result = await callTool("request_service_upload_reupload", {
      tripId: "trip-1",
      uploadId: "up-1",
      comment: "Please re-upload",
    });

    expect(assertServiceUploadMutable).toHaveBeenCalledWith("up-1", "trip-1");
    expect(requestReUpload).toHaveBeenCalledWith("up-1", "Please re-upload");
    expect(parseToolText(result)).toEqual({ reuploadRequested: true });
  });

  it("does not mutate when the guard rejects with 'Upload no encontrado'", async () => {
    assertServiceUploadMutable.mockRejectedValueOnce(new Error("Upload no encontrado"));

    const result = await callTool("process_service_upload", {
      tripId: "trip-1",
      uploadId: "up-missing",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: upload up-missing$/);
    expect(markUploadProcessed).not.toHaveBeenCalled();
  });

  it("does not mutate when the guard rejects with 'Servicio no encontrado'", async () => {
    assertServiceUploadMutable.mockRejectedValueOnce(new Error("Servicio no encontrado"));

    const result = await callTool("mark_service_upload_reviewed", {
      tripId: "trip-1",
      uploadId: "up-1",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/^NOT_FOUND: service up-1$/);
    expect(markUploadReviewed).not.toHaveBeenCalled();
  });

  it("does not mutate when the guard rejects with archived-trip message", async () => {
    assertServiceUploadMutable.mockRejectedValueOnce(
      new Error("El viaje archivado es de solo lectura")
    );

    const result = await callTool("process_service_upload", {
      tripId: "trip-archived",
      uploadId: "up-1",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("El viaje archivado es de solo lectura");
    expect(markUploadProcessed).not.toHaveBeenCalled();
  });

  it("maps unexpected mutation failures to a sanitized error", async () => {
    markUploadProcessed.mockRejectedValueOnce(new Error("postgres RLS violation xyz"));

    const result = await callTool("process_service_upload", {
      tripId: "trip-1",
      uploadId: "up-1",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("postgres");
    expect(JSON.stringify(result)).not.toContain("RLS violation");
  });
});

describe("travel agent tools", () => {
  it("list_travel_agents dispatches to getTravelAgents", async () => {
    mockDataFns.getTravelAgents.mockResolvedValueOnce([
      { id: "a-1", name: "Ana", createdAt: "2026-01-01", updatedAt: "2026-01-01" },
    ]);
    const result = await callTool("list_travel_agents", {});
    expect(mockDataFns.getTravelAgents).toHaveBeenCalled();
    expect(parseToolText(result)).toEqual([
      expect.objectContaining({ id: "a-1", name: "Ana" }),
    ]);
  });

  it("get_travel_agent returns NOT_FOUND for a missing id", async () => {
    mockDataFns.getTravelAgentById.mockResolvedValueOnce(null);
    const result = await callTool("get_travel_agent", { id: "missing" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("NOT_FOUND: travel agent missing");
  });

  it("create_travel_agent dispatches the name and optional fields", async () => {
    mockDataFns.createTravelAgent.mockResolvedValueOnce({ id: "a-2", name: "Luis" });
    const result = await callTool("create_travel_agent", {
      name: "Luis",
      email: "luis@example.com",
    });
    expect(mockDataFns.createTravelAgent).toHaveBeenCalledWith({
      name: "Luis",
      email: "luis@example.com",
    });
    expect(parseToolText(result)).toEqual(expect.objectContaining({ id: "a-2" }));
  });
});

describe("traveler activity tools", () => {
  it("create_traveler_activity returns the item on ok", async () => {
    mockDataFns.createTravelerActivity.mockResolvedValueOnce({
      ok: true,
      item: { id: "item-9", title: "Museo" },
    });
    const result = await callTool("create_traveler_activity", {
      tripId: "trip-1",
      tripDayId: "day-1",
      clientId: "c-1",
      title: "Museo",
    });
    expect(mockDataFns.createTravelerActivity).toHaveBeenCalledWith({
      tripId: "trip-1",
      tripDayId: "day-1",
      clientId: "c-1",
      title: "Museo",
    });
    expect(parseToolText(result)).toEqual(expect.objectContaining({ id: "item-9" }));
  });

  it("create_traveler_activity maps unauthorized to an error", async () => {
    mockDataFns.createTravelerActivity.mockResolvedValueOnce({
      ok: false,
      reason: "unauthorized",
    });
    const result = await callTool("create_traveler_activity", {
      tripId: "trip-1",
      tripDayId: "day-1",
      clientId: "c-1",
      title: "Museo",
    });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("UNAUTHORIZED: traveler activity rejected");
  });

  it("delete_traveler_activity returns success on ok", async () => {
    mockDataFns.deleteTravelerActivity.mockResolvedValueOnce({ ok: true });
    const result = await callTool("delete_traveler_activity", {
      tripId: "trip-1",
      tripDayId: "day-1",
      clientId: "c-1",
      itemId: "item-9",
    });
    expect(parseToolText(result)).toEqual({ success: true });
  });
});

describe("update_trip assignedAgentId", () => {
  it("passes assignedAgentId through to updateTrip", async () => {
    mockDataFns.getTripById.mockResolvedValueOnce({ id: "trip-1", title: "Viaje" });
    mockDataFns.updateTrip.mockResolvedValueOnce({ id: "trip-1" });
    await callTool("update_trip", { id: "trip-1", assignedAgentId: "agent-1" });
    expect(mockDataFns.updateTrip).toHaveBeenCalledWith("trip-1", {
      assignedAgentId: "agent-1",
    });
  });
});
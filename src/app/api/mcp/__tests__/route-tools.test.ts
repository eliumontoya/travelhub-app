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
}));

const EXPECTED_TOOLS = [
  "list_services",
  "get_service_checklist",
  "get_service_document_summaries",
  "get_service_upload_download_url",
  "process_service_upload",
  "mark_service_upload_reviewed",
  "request_service_upload_reupload",
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MCP service-document tools — registration", () => {
  it("registers exactly the seven documented tools", async () => {
    const tools = await bootClientAndListTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...EXPECTED_TOOLS].sort());
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
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getSignedServiceDocumentUploadUrl = vi.fn();

vi.mock("@/lib/data", () => ({
  getSignedServiceDocumentUploadUrl,
}));

interface ToolCallResult {
  content: Array<{ type: string; text?: string }>;
  isError?: boolean;
}

async function bootClient(): Promise<Client> {
  const { registerDocumentTools } = await import("@/lib/mcp/tools/documents");
  const server = new McpServer({ name: "test-documents", version: "0.0.0" });
  registerDocumentTools(server);

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

beforeEach(() => {
  getSignedServiceDocumentUploadUrl.mockReset();
  getSignedServiceDocumentUploadUrl.mockResolvedValue(
    "https://signed.test/upload/trips/trip-1/doc.pdf?token=t"
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("get_document_upload_url", () => {
  it("returns { uploadUrl, expiresIn } with default 300 when omitted", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_document_upload_url", {
      path: "trips/trip-1/doc.pdf",
    });
    expect(getSignedServiceDocumentUploadUrl).toHaveBeenCalledWith(
      "trips/trip-1/doc.pdf",
      300
    );
    expect(parseToolText(result)).toEqual({
      uploadUrl: "https://signed.test/upload/trips/trip-1/doc.pdf?token=t",
      expiresIn: 300,
    });
  });

  it("echoes a custom expiresIn in 60..604800", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_document_upload_url", {
      path: "trips/trip-1/doc.pdf",
      expiresIn: 3600,
    });
    expect(getSignedServiceDocumentUploadUrl).toHaveBeenCalledWith(
      "trips/trip-1/doc.pdf",
      3600
    );
    expect(parseToolText(result)).toEqual({
      uploadUrl: "https://signed.test/upload/trips/trip-1/doc.pdf?token=t",
      expiresIn: 3600,
    });
  });

  it("rejects an empty path", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_document_upload_url", { path: "" });
    expect(result.isError).toBe(true);
    expect(getSignedServiceDocumentUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects expiresIn below the floor (60)", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_document_upload_url", {
      path: "p.pdf",
      expiresIn: 30,
    });
    expect(result.isError).toBe(true);
    expect(getSignedServiceDocumentUploadUrl).not.toHaveBeenCalled();
  });

  it("rejects expiresIn above the ceiling (604800)", async () => {
    const client = await bootClient();
    const result = await callTool(client, "get_document_upload_url", {
      path: "p.pdf",
      expiresIn: 999999,
    });
    expect(result.isError).toBe(true);
    expect(getSignedServiceDocumentUploadUrl).not.toHaveBeenCalled();
  });

  it("sanitizes unexpected throws without leaking internals", async () => {
    getSignedServiceDocumentUploadUrl.mockRejectedValueOnce(
      new Error("SERVICE_ROLE_KEY leak at 10.0.0.5")
    );
    const client = await bootClient();
    const result = await callTool(client, "get_document_upload_url", { path: "p.pdf" });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("An unexpected error occurred");
    expect(JSON.stringify(result)).not.toContain("SERVICE_ROLE_KEY");
    expect(JSON.stringify(result)).not.toContain("10.0.0.5");
  });
});
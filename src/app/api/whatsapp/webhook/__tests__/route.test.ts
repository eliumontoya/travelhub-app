import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const processWhatsAppWebhookPayload = vi.fn();
class MockWhatsAppStoreConfigurationError extends Error {}

vi.mock("@/lib/whatsapp/inbound-service", () => ({
  processWhatsAppWebhookPayload,
}));

vi.mock("@/lib/whatsapp/store", () => ({
  WhatsAppStoreConfigurationError: MockWhatsAppStoreConfigurationError,
}));

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

const appSecret = "meta-app-secret";

function signBody(rawBody: string, secret = appSecret) {
  return `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
}

function signedPost(rawBody: string, signatureHeader = signBody(rawBody)) {
  return request("https://travelhub.test/api/whatsapp/webhook", {
    method: "POST",
    body: rawBody,
    headers: { "x-hub-signature-256": signatureHeader },
  });
}

function unsignedPost(rawBody: string, signatureHeader?: string) {
  return request("https://travelhub.test/api/whatsapp/webhook", {
    method: "POST",
    body: rawBody,
    ...(signatureHeader === undefined ? {} : { headers: { "x-hub-signature-256": signatureHeader } }),
  });
}

describe("GET /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    processWhatsAppWebhookPayload.mockReset();
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-secret";
    process.env.WHATSAPP_APP_SECRET = appSecret;
  });

  it("returns Meta challenge when mode and verify token match", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      request("https://travelhub.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=verify-secret&hub.challenge=challenge-123")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(await response.text()).toBe("challenge-123");
  });

  it("rejects verification requests with a wrong token", async () => {
    const { GET } = await import("../route");

    const response = await GET(
      request("https://travelhub.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=challenge-123")
    );

    expect(response.status).toBe(403);
  });
});

describe("POST /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    processWhatsAppWebhookPayload.mockReset();
    process.env.WHATSAPP_APP_SECRET = appSecret;
  });

  it("delegates inbound payload orchestration", async () => {
    processWhatsAppWebhookPayload.mockResolvedValueOnce({ received: 1, processed: 1, duplicates: 0, autoAnswered: 1, escalated: 0, sendFailures: 0, events: [] });
    const { POST } = await import("../route");
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.text-1" }] } }] }] };

    const response = await POST(signedPost(JSON.stringify(payload)));

    await expect(response.json()).resolves.toMatchObject({ received: 1, processed: 1, autoAnswered: 1 });
    expect(response.status).toBe(200);
    expect(processWhatsAppWebhookPayload).toHaveBeenCalledWith(payload);
  });

  it("acknowledges duplicate webhook deliveries without failing", async () => {
    processWhatsAppWebhookPayload.mockResolvedValueOnce({ received: 1, processed: 0, duplicates: 1, autoAnswered: 0, escalated: 0, sendFailures: 0, events: [] });
    const { POST } = await import("../route");

    const response = await POST(signedPost(JSON.stringify({ entry: [] })));

    await expect(response.json()).resolves.toMatchObject({ received: 1, duplicates: 1 });
    expect(response.status).toBe(200);
  });

  it.each([
    ["missing signature", undefined],
    ["wrong prefix", `sha1=${createHmac("sha256", appSecret).update(JSON.stringify({ entry: [] }), "utf8").digest("hex")}`],
    ["non-hex digest", "sha256=not-hex"],
    ["short digest", "sha256=abc123"],
  ])("rejects %s before processing", async (_name, signatureHeader) => {
    const { POST } = await import("../route");
    const rawBody = JSON.stringify({ entry: [] });

    const response = await POST(unsignedPost(rawBody, signatureHeader));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(processWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });

  it("rejects a mismatched signature before processing", async () => {
    const { POST } = await import("../route");
    const signedRawBody = JSON.stringify({ entry: [{ id: "entry-1" }] });
    const deliveredRawBody = JSON.stringify({ entry: [{ id: "entry-2" }] });

    const response = await POST(signedPost(deliveredRawBody, signBody(signedRawBody)));

    expect(response.status).toBe(401);
    expect(processWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });

  it("rejects a byte-different body even when JSON is semantically equivalent", async () => {
    const { POST } = await import("../route");
    const signedRawBody = JSON.stringify({ entry: [{ id: "entry-1" }] });
    const deliveredRawBody = JSON.stringify({ entry: [{ id: "entry-1" }] }, null, 2);

    const response = await POST(signedPost(deliveredRawBody, signBody(signedRawBody)));

    expect(response.status).toBe(401);
    expect(processWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON only after signature verification succeeds", async () => {
    const { POST } = await import("../route");
    const rawBody = "{not-json";

    const response = await POST(signedPost(rawBody));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Invalid JSON payload" });
    expect(processWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });

  it("returns 503 without exposing secrets when the Meta app secret is not configured", async () => {
    process.env.WHATSAPP_APP_SECRET = "";
    const { POST } = await import("../route");
    const rawBody = JSON.stringify({ entry: [] });

    const response = await POST(signedPost(rawBody));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "WhatsApp webhook signing secret is not configured" });
    expect(processWhatsAppWebhookPayload).not.toHaveBeenCalled();
  });

  it("returns 503 without exposing secrets when persistence is not configured", async () => {
    processWhatsAppWebhookPayload.mockRejectedValueOnce(new MockWhatsAppStoreConfigurationError());
    const { POST } = await import("../route");

    const response = await POST(signedPost(JSON.stringify({ entry: [] })));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "WhatsApp webhook persistence is not configured",
    });
  });
});

it("acknowledges status-only webhook payloads", async () => {
  vi.resetModules();
  processWhatsAppWebhookPayload.mockReset();
  process.env.WHATSAPP_APP_SECRET = appSecret;
  processWhatsAppWebhookPayload.mockResolvedValueOnce({
    received: 0,
    processed: 0,
    duplicates: 0,
    autoAnswered: 0,
    escalated: 0,
    sendFailures: 0,
    events: [],
    statusCallbacks: { received: 1, inserted: 1, duplicates: 0, matched: 1, updated: 1 },
  });
  const { POST } = await import("../route");
  const payload = { entry: [{ changes: [{ value: { statuses: [{ id: "wamid.out-1", status: "read" }] } }] }] };

  const response = await POST(signedPost(JSON.stringify(payload)));

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    received: 0,
    statusCallbacks: { received: 1, updated: 1 },
  });
  expect(processWhatsAppWebhookPayload).toHaveBeenCalledWith(payload);
});

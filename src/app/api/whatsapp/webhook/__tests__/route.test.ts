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

describe("GET /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    processWhatsAppWebhookPayload.mockReset();
    process.env.WHATSAPP_VERIFY_TOKEN = "verify-secret";
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
  });

  it("delegates inbound payload orchestration", async () => {
    processWhatsAppWebhookPayload.mockResolvedValueOnce({ received: 1, processed: 1, duplicates: 0, autoAnswered: 1, escalated: 0, sendFailures: 0, events: [] });
    const { POST } = await import("../route");
    const payload = { entry: [{ changes: [{ value: { messages: [{ id: "wamid.text-1" }] } }] }] };

    const response = await POST(
      request("https://travelhub.test/api/whatsapp/webhook", {
        method: "POST",
        body: JSON.stringify(payload),
      })
    );

    await expect(response.json()).resolves.toMatchObject({ received: 1, processed: 1, autoAnswered: 1 });
    expect(response.status).toBe(200);
    expect(processWhatsAppWebhookPayload).toHaveBeenCalledWith(payload);
  });

  it("acknowledges duplicate webhook deliveries without failing", async () => {
    processWhatsAppWebhookPayload.mockResolvedValueOnce({ received: 1, processed: 0, duplicates: 1, autoAnswered: 0, escalated: 0, sendFailures: 0, events: [] });
    const { POST } = await import("../route");

    const response = await POST(
      request("https://travelhub.test/api/whatsapp/webhook", {
        method: "POST",
        body: JSON.stringify({ entry: [] }),
      })
    );

    await expect(response.json()).resolves.toMatchObject({ received: 1, duplicates: 1 });
    expect(response.status).toBe(200);
  });

  it("returns 503 without exposing secrets when persistence is not configured", async () => {
    processWhatsAppWebhookPayload.mockRejectedValueOnce(new MockWhatsAppStoreConfigurationError());
    const { POST } = await import("../route");

    const response = await POST(
      request("https://travelhub.test/api/whatsapp/webhook", {
        method: "POST",
        body: JSON.stringify({ entry: [] }),
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "WhatsApp webhook persistence is not configured",
    });
  });
});

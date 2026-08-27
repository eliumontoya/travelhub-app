import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ingestWhatsAppInboundEvents = vi.fn();
class MockWhatsAppStoreConfigurationError extends Error {}

vi.mock("@/lib/whatsapp/store", () => ({
  ingestWhatsAppInboundEvents,
  WhatsAppStoreConfigurationError: MockWhatsAppStoreConfigurationError,
}));

function request(url: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(url, init);
}

describe("GET /api/whatsapp/webhook", () => {
  beforeEach(() => {
    vi.resetModules();
    ingestWhatsAppInboundEvents.mockReset();
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
    ingestWhatsAppInboundEvents.mockReset();
  });

  it("normalizes and delegates inbound payload persistence", async () => {
    ingestWhatsAppInboundEvents.mockResolvedValueOnce({ received: 1, inserted: 1, duplicates: 0 });
    const { POST } = await import("../route");

    const response = await POST(
      request("https://travelhub.test/api/whatsapp/webhook", {
        method: "POST",
        body: JSON.stringify({
          entry: [
            {
              changes: [
                {
                  value: {
                    metadata: { phone_number_id: "phone-number-id-1" },
                    contacts: [{ wa_id: "5215551234567", profile: { name: "Jane" } }],
                    messages: [
                      {
                        from: "5215551234567",
                        id: "wamid.text-1",
                        timestamp: "1798224000",
                        type: "text",
                        text: { body: "Hola" },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        }),
      })
    );

    await expect(response.json()).resolves.toEqual({ received: 1, inserted: 1, duplicates: 0 });
    expect(response.status).toBe(200);
    expect(ingestWhatsAppInboundEvents).toHaveBeenCalledWith([
      expect.objectContaining({ providerMessageId: "wamid.text-1", body: "Hola" }),
    ]);
  });

  it("acknowledges duplicate webhook deliveries without failing", async () => {
    ingestWhatsAppInboundEvents.mockResolvedValueOnce({ received: 1, inserted: 0, duplicates: 1 });
    const { POST } = await import("../route");

    const response = await POST(
      request("https://travelhub.test/api/whatsapp/webhook", {
        method: "POST",
        body: JSON.stringify({ entry: [] }),
      })
    );

    await expect(response.json()).resolves.toEqual({ received: 1, inserted: 0, duplicates: 1 });
    expect(response.status).toBe(200);
  });

  it("returns 503 without exposing secrets when persistence is not configured", async () => {
    ingestWhatsAppInboundEvents.mockRejectedValueOnce(new MockWhatsAppStoreConfigurationError());
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

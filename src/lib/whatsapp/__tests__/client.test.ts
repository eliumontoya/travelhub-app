import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp/client";

describe("sendWhatsAppTextMessage", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the Meta Cloud API text request with injected fetch", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token-123");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "phone-id-123");
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.out-1" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    const result = await sendWhatsAppTextMessage({ to: "5215551234567", body: "Hola" }, fetchImpl as typeof fetch);

    expect(result).toMatchObject({ ok: true, status: 200, providerMessageId: "wamid.out-1" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://graph.facebook.com/v20.0/phone-id-123/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer token-123" }),
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "5215551234567",
          type: "text",
          text: { preview_url: false, body: "Hola" },
        }),
      })
    );
  });

  it("skips gracefully when credentials are missing", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
    const fetchImpl = vi.fn();

    const result = await sendWhatsAppTextMessage({ to: "5215551234567", body: "Hola" }, fetchImpl as typeof fetch);

    expect(result).toMatchObject({ ok: false, skipped: true, status: null });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

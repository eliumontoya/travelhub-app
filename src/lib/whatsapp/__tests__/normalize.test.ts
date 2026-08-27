import { describe, expect, it } from "vitest";
import { normalizeWhatsAppWebhookPayload } from "@/lib/whatsapp/normalize";

const textPayload = {
  object: "whatsapp_business_account",
  entry: [
    {
      id: "waba-1",
      changes: [
        {
          field: "messages",
          value: {
            messaging_product: "whatsapp",
            metadata: {
              display_phone_number: "15551234567",
              phone_number_id: "phone-number-id-1",
            },
            contacts: [
              {
                profile: { name: "Jane Traveler" },
                wa_id: "5215551234567",
              },
            ],
            messages: [
              {
                from: "5215551234567",
                id: "wamid.text-1",
                timestamp: "1798224000",
                text: { body: "Hola, quiero cotizar un viaje a Japón" },
                type: "text",
              },
            ],
          },
        },
      ],
    },
  ],
};

describe("normalizeWhatsAppWebhookPayload", () => {
  it("normalizes a Meta inbound text message", () => {
    const events = normalizeWhatsAppWebhookPayload(textPayload);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerMessageId: "wamid.text-1",
      fromPhone: "5215551234567",
      profileName: "Jane Traveler",
      businessPhoneNumberId: "phone-number-id-1",
      messageType: "text",
      body: "Hola, quiero cotizar un viaje a Japón",
      occurredAt: new Date(1798224000 * 1000).toISOString(),
    });
    expect(events[0].rawMessage).toMatchObject({ id: "wamid.text-1", type: "text" });
    expect(events[0].rawValue).toMatchObject({ messaging_product: "whatsapp" });
  });

  it("normalizes unsupported inbound message types without throwing", () => {
    const unsupportedPayload = structuredClone(textPayload);
    unsupportedPayload.entry[0].changes[0].value.messages[0] = {
      from: "5215551234567",
      id: "wamid.image-1",
      timestamp: "1798224060",
      type: "image",
      image: { id: "media-1", mime_type: "image/jpeg" },
    } as never;

    const events = normalizeWhatsAppWebhookPayload(unsupportedPayload);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      providerMessageId: "wamid.image-1",
      fromPhone: "5215551234567",
      messageType: "image",
      body: undefined,
    });
    expect(events[0].rawMessage).toMatchObject({ image: { id: "media-1" } });
    expect(events[0].rawValue).toMatchObject({ metadata: { phone_number_id: "phone-number-id-1" } });
  });
});

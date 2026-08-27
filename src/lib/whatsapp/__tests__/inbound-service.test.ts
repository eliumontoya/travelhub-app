import { describe, expect, it, vi } from "vitest";
import { processWhatsAppInboundEvents } from "@/lib/whatsapp/inbound-service";
import type { NormalizedWhatsAppInboundEvent } from "@/lib/whatsapp/normalize";
import type { WhatsAppStore } from "@/lib/whatsapp/store";

const textEvent: NormalizedWhatsAppInboundEvent = {
  providerMessageId: "wamid.in-1",
  fromPhone: "5215551234567",
  profileName: "Jane Traveler",
  businessPhoneNumberId: "phone-id-1",
  messageType: "text",
  body: "¿Cuál es su horario?",
  occurredAt: "2026-12-25T00:00:00.000Z",
  rawMessage: { id: "wamid.in-1", type: "text" },
  rawValue: { messaging_product: "whatsapp" },
};

const imageEvent: NormalizedWhatsAppInboundEvent = {
  ...textEvent,
  providerMessageId: "wamid.image-1",
  messageType: "image",
  body: undefined,
  rawMessage: { id: "wamid.image-1", type: "image" },
};

function makeStore(inserted = true) {
  const persisted = { inserted, contactId: "contact-1", conversationId: "conversation-1", messageId: "message-1" };
  const store: WhatsAppStore = {
    persistInboundEvent: vi.fn(async () => persisted),
    loadConversationContext: vi.fn(async () => ({ assignedTripId: null, lastIntent: null })),
    createIntent: vi.fn(async () => ({ id: "intent-1" })),
    insertOutboundMessage: vi.fn(async () => ({ id: "outbound-1" })),
    createEscalation: vi.fn(async () => ({ id: "escalation-1" })),
    createCrmSyncEvent: vi.fn(async () => ({ id: "crm-1" })),
    updateConversationStatus: vi.fn(async () => undefined),
    markInboundMessageProcessed: vi.fn(async () => undefined),
    persistStatusEvents: vi.fn(async (events) => ({ received: events.length, inserted: events.length, duplicates: 0, matched: events.length, updated: events.length })),
  };
  return store;
}

describe("processWhatsAppInboundEvents", () => {
  it("persists intent, outbound answer, CRM event, and conversation state for auto-answer", async () => {
    const store = makeStore();
    const agent = vi.fn(async () => ({
      intent: "inquiry" as const,
      summary: "Pregunta por horario",
      confidence: 0.92,
      decision: "auto_answer" as const,
      responseText: "Atendemos de lunes a viernes.",
      citedKnowledgeIds: ["knowledge-1"],
      citedToolCallIds: [],
    }));
    const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out-1" }));

    const result = await processWhatsAppInboundEvents([textEvent], { store, agent, sendText });

    expect(result).toMatchObject({ received: 1, processed: 1, duplicates: 0, autoAnswered: 1, escalated: 0 });
    expect(store.createIntent).toHaveBeenCalledWith(expect.objectContaining({ decision: expect.objectContaining({ decision: "auto_answer" }) }));
    expect(sendText).toHaveBeenCalledWith({ to: "5215551234567", body: "Atendemos de lunes a viernes.", phoneNumberId: "phone-id-1" });
    expect(store.insertOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({ purpose: "auto_answer", status: "sent" }));
    expect(store.createCrmSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "whatsapp.auto_answered" }));
    expect(store.markInboundMessageProcessed).toHaveBeenCalledWith({ messageId: "message-1", status: "responded" });
  });

  it("creates escalation, customer follow-up, human alert attempt, and CRM event for needs_human", async () => {
    const store = makeStore();
    const agent = vi.fn(async () => ({
      intent: "quote_request" as const,
      summary: "Quiere cotización",
      confidence: 0.8,
      decision: "needs_human" as const,
      responseText:
        "Gracias por contarnos lo que buscas. Para cotizarlo correctamente, un asesor revisará tu solicitud y te dará seguimiento personalmente.",
      escalationReason: "Requiere cotización humana.",
      citedKnowledgeIds: [],
      citedToolCallIds: [],
    }));
    const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out" }));

    const result = await processWhatsAppInboundEvents([textEvent], {
      store,
      agent,
      sendText,
      humanAlertPhone: "5215559990000",
    });

    expect(result).toMatchObject({ escalated: 1, autoAnswered: 0 });
    expect(sendText).toHaveBeenCalledTimes(2);
    expect(sendText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        to: "5215551234567",
        body: "Gracias por contarnos lo que buscas. Para cotizarlo correctamente, un asesor revisará tu solicitud y te dará seguimiento personalmente.",
      })
    );
    expect(sendText).toHaveBeenLastCalledWith(expect.objectContaining({ to: "5215559990000" }));
    expect(store.createEscalation).toHaveBeenCalledWith(expect.objectContaining({ intentId: "intent-1" }));
    expect(store.insertOutboundMessage).toHaveBeenCalledWith(expect.objectContaining({ purpose: "escalation_customer_follow_up" }));
    expect(store.createCrmSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "whatsapp.escalated" }));
    expect(store.updateConversationStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "escalated" }));
  });

  it("escalates unsupported non-text messages without crashing", async () => {
    const store = makeStore();
    const agent = vi.fn();
    const sendText = vi.fn(async () => ({ ok: false, skipped: true, status: null, error: "missing credentials" }));

    const result = await processWhatsAppInboundEvents([imageEvent], { store, agent, sendText });

    expect(result.events[0]).toMatchObject({ action: "unsupported_escalated" });
    expect(agent).not.toHaveBeenCalled();
    expect(store.createEscalation).toHaveBeenCalled();
    expect(store.createCrmSyncEvent).toHaveBeenCalledWith(expect.objectContaining({ eventType: "whatsapp.escalated" }));
  });

  it("does not duplicate outbound sends when inbound message is already processed", async () => {
    const store = makeStore(false);
    const agent = vi.fn();
    const sendText = vi.fn();

    const result = await processWhatsAppInboundEvents([textEvent], { store, agent, sendText });

    expect(result).toMatchObject({ received: 1, processed: 0, duplicates: 1 });
    expect(result.events[0]).toMatchObject({ action: "duplicate_skipped" });
    expect(agent).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
    expect(store.createIntent).not.toHaveBeenCalled();
  });
});


it("processes status callbacks without inbound side effects", async () => {
  const store = makeStore();
  const agent = vi.fn();
  const sendText = vi.fn();
  const { processWhatsAppWebhookPayload } = await import("@/lib/whatsapp/inbound-service");
  const payload = {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone-id-1" },
              statuses: [
                {
                  id: "wamid.out-1",
                  status: "delivered",
                  timestamp: "1798224300",
                  recipient_id: "5215551234567",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const result = await processWhatsAppWebhookPayload(payload, { store, agent, sendText });

  expect(result.received).toBe(0);
  expect(result.statusCallbacks).toMatchObject({ received: 1, inserted: 1 });
  expect(store.persistInboundEvent).not.toHaveBeenCalled();
  expect(agent).not.toHaveBeenCalled();
  expect(sendText).not.toHaveBeenCalled();
});

it("does not require status persistence for inbound-only payloads", async () => {
  const store = makeStore();
  const agent = vi.fn(async () => ({
    intent: "inquiry" as const,
    summary: "Pregunta por horario",
    confidence: 0.92,
    decision: "auto_answer" as const,
    responseText: "Atendemos de lunes a viernes.",
    citedKnowledgeIds: ["knowledge-1"],
    citedToolCallIds: [],
  }));
  const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out-1" }));
  const { processWhatsAppWebhookPayload } = await import("@/lib/whatsapp/inbound-service");

  const result = await processWhatsAppWebhookPayload(
    { entry: [{ changes: [{ value: { metadata: { phone_number_id: "phone-id-1" }, contacts: [], messages: [{ id: textEvent.providerMessageId, from: textEvent.fromPhone, type: "text", text: { body: textEvent.body }, timestamp: "1798224000" }] } }] }] },
    { store, agent, sendText }
  );

  expect(result.received).toBe(1);
  expect(result.statusCallbacks).toEqual({ received: 0, inserted: 0, duplicates: 0, matched: 0, updated: 0 });
  expect(store.persistStatusEvents).not.toHaveBeenCalled();
});

describe("processWhatsAppInboundEvents dynamic TravelHub tools", () => {
  it("passes safe dynamic tool results to the agent for a single active trip", async () => {
    const store = makeStore();
    const travelHubToolRunner = vi
      .fn()
      .mockResolvedValueOnce({
        tool: "getClientByWhatsappPhone",
        status: "success",
        data: { found: true, clientId: "client-1", displayName: "Jane", matchConfidence: "exact" },
      })
      .mockResolvedValueOnce({
        tool: "getClientActiveTrips",
        status: "success",
        data: { trips: [{ tripId: "trip-1", title: "Cancún", slug: "cancun", startDate: "2026-09-01", endDate: "2026-09-05", status: "published" }] },
      })
      .mockResolvedValueOnce({
        tool: "getTripSummary",
        status: "success",
        data: { tripId: "trip-1", title: "Cancún", status: "published", publicItineraryAvailable: true },
      });
    const agent = vi.fn(async (input) => ({
      intent: "existing_trip" as const,
      summary: "Consulta estado de viaje",
      confidence: 0.88,
      decision: "auto_answer" as const,
      responseText: `Tu viaje ${input.dynamicToolResults[2].data.title} está publicado. Gracias por tu confianza.`,
      citedKnowledgeIds: [],
      citedToolCallIds: ["getTripSummary:3"],
    }));
    const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out-1" }));

    const result = await processWhatsAppInboundEvents(
      [{ ...textEvent, body: "¿Cómo va mi viaje?" }],
      { store, agent, travelHubToolRunner, sendText }
    );

    expect(result).toMatchObject({ autoAnswered: 1, escalated: 0 });
    expect(travelHubToolRunner).toHaveBeenNthCalledWith(1, { tool: "getClientByWhatsappPhone", arguments: { phone: "5215551234567" } });
    expect(travelHubToolRunner).toHaveBeenNthCalledWith(2, { tool: "getClientActiveTrips", arguments: { clientId: "client-1" } });
    expect(travelHubToolRunner).toHaveBeenNthCalledWith(3, { tool: "getTripSummary", arguments: { clientId: "client-1", tripId: "trip-1" } });
    expect(agent).toHaveBeenCalledWith(
      expect.objectContaining({
        dynamicToolResults: expect.arrayContaining([
          expect.objectContaining({ id: "getTripSummary:3", status: "success" }),
        ]),
      }),
      expect.any(Object)
    );
    expect(store.createIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: expect.objectContaining({
          citedToolCallIds: ["getTripSummary:3"],
          dynamicToolResults: expect.arrayContaining([expect.objectContaining({ tool: "getTripSummary" })]),
        }),
      })
    );
  });

  it("asks for clarification when active trips are ambiguous", async () => {
    const store = makeStore();
    const travelHubToolRunner = vi
      .fn()
      .mockResolvedValueOnce({ tool: "getClientByWhatsappPhone", status: "success", data: { found: true, clientId: "client-1", matchConfidence: "exact" } })
      .mockResolvedValueOnce({
        tool: "getClientActiveTrips",
        status: "ambiguous",
        data: { trips: [{ tripId: "trip-1", title: "Cancún" }, { tripId: "trip-2", title: "Madrid" }] },
        reason: "Multiple active or recent trips require clarification.",
      });
    const agent = vi.fn(async () => ({
      intent: "existing_trip" as const,
      summary: "Necesita aclarar viaje",
      confidence: 0.82,
      decision: "needs_human" as const,
      responseText: "Gracias por escribirnos. ¿Te refieres al viaje a Cancún o al viaje a Madrid?",
      escalationReason: "Hay múltiples viajes posibles.",
      citedKnowledgeIds: [],
      citedToolCallIds: [],
    }));
    const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out-1" }));

    const result = await processWhatsAppInboundEvents(
      [{ ...textEvent, body: "¿Cómo va mi viaje?" }],
      { store, agent, travelHubToolRunner, sendText, humanAlertPhone: "5215559990000" }
    );

    expect(result).toMatchObject({ autoAnswered: 0, escalated: 1 });
    expect(travelHubToolRunner).toHaveBeenCalledTimes(2);
    expect(agent).toHaveBeenCalledWith(
      expect.objectContaining({ dynamicToolResults: expect.arrayContaining([expect.objectContaining({ status: "ambiguous" })]) }),
      expect.any(Object)
    );
  });

  it.each([
    ["not_found", "No TravelHub client is linked to this WhatsApp phone."],
    ["blocked", "Invalid phone input."],
    ["error", "TravelHub lookup failed."],
  ] as const)("passes %s client resolution safely without running trip tools", async (status, reason) => {
    const store = makeStore();
    const travelHubToolRunner = vi.fn(async () => ({ tool: "getClientByWhatsappPhone", status, reason }));
    const agent = vi.fn(async () => ({
      intent: "existing_trip" as const,
      summary: "No se puede validar cliente",
      confidence: 0.7,
      decision: "needs_human" as const,
      responseText: "Gracias por escribirnos. Un asesor validará tu información para proteger tus datos.",
      escalationReason: reason,
      citedKnowledgeIds: [],
      citedToolCallIds: [],
    }));
    const sendText = vi.fn(async () => ({ ok: false, skipped: true, status: null, error: "missing credentials" }));

    await processWhatsAppInboundEvents([{ ...textEvent, body: "¿Cómo va mi viaje?" }], { store, agent, travelHubToolRunner, sendText });

    expect(travelHubToolRunner).toHaveBeenCalledTimes(1);
    expect(agent).toHaveBeenCalledWith(
      expect.objectContaining({ dynamicToolResults: [expect.objectContaining({ tool: "getClientByWhatsappPhone", status })] }),
      expect.any(Object)
    );
  });



  it("passes blocked trip-scoped results from assigned conversation trips", async () => {
    const store = makeStore();
    store.loadConversationContext = vi.fn(async () => ({ assignedTripId: "other-trip", lastIntent: null }));
    const travelHubToolRunner = vi
      .fn()
      .mockResolvedValueOnce({ tool: "getClientByWhatsappPhone", status: "success", data: { found: true, clientId: "client-1", matchConfidence: "exact" } })
      .mockResolvedValueOnce({ tool: "getTripSummary", status: "blocked", reason: "Requested trip does not belong to the resolved WhatsApp client." });
    const agent = vi.fn(async () => ({
      intent: "existing_trip" as const,
      summary: "Ownership bloqueado",
      confidence: 0.8,
      decision: "needs_human" as const,
      responseText: "Gracias por escribirnos. Para proteger tu información, un asesor validará el viaje antes de compartir detalles.",
      escalationReason: "La consulta de viaje fue bloqueada por validación de ownership.",
      citedKnowledgeIds: [],
      citedToolCallIds: [],
    }));
    const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out-1" }));

    await processWhatsAppInboundEvents(
      [{ ...textEvent, body: "¿Cómo va mi viaje?" }],
      { store, agent, travelHubToolRunner, sendText, humanAlertPhone: "5215559990000" }
    );

    expect(travelHubToolRunner).toHaveBeenLastCalledWith({ tool: "getTripSummary", arguments: { clientId: "client-1", tripId: "other-trip" } });
    expect(agent).toHaveBeenCalledWith(
      expect.objectContaining({ dynamicToolResults: expect.arrayContaining([expect.objectContaining({ tool: "getTripSummary", status: "blocked" })]) }),
      expect.any(Object)
    );
  });

  it("runs payment tool but keeps payment status on the human path", async () => {
    const store = makeStore();
    const travelHubToolRunner = vi
      .fn()
      .mockResolvedValueOnce({ tool: "getClientByWhatsappPhone", status: "success", data: { found: true, clientId: "client-1", matchConfidence: "exact" } })
      .mockResolvedValueOnce({ tool: "getClientActiveTrips", status: "success", data: { trips: [{ tripId: "trip-1", title: "Cancún" }] } })
      .mockResolvedValueOnce({ tool: "getTripPaymentStatus", status: "needs_human", reason: "Payment status requires policy." });
    const agent = vi.fn(async () => ({
      intent: "existing_trip" as const,
      summary: "Consulta pago",
      confidence: 0.85,
      decision: "needs_human" as const,
      responseText: "Gracias por tu paciencia. Un asesor revisará el estatus de pago y te dará seguimiento personal.",
      escalationReason: "Los pagos requieren revisión humana.",
      citedKnowledgeIds: [],
      citedToolCallIds: [],
    }));
    const sendText = vi.fn(async () => ({ ok: true, status: 200, providerMessageId: "wamid.out-1" }));

    const result = await processWhatsAppInboundEvents(
      [{ ...textEvent, body: "¿Ya aparece mi pago?" }],
      { store, agent, travelHubToolRunner, sendText, humanAlertPhone: "5215559990000" }
    );

    expect(result.escalated).toBe(1);
    expect(travelHubToolRunner).toHaveBeenLastCalledWith({ tool: "getTripPaymentStatus", arguments: { clientId: "client-1", tripId: "trip-1" } });
    expect(JSON.stringify(result)).not.toMatch(/saldo|monto|service-role|Supabase/i);
  });

  it("skips dynamic tools for duplicate inbound messages", async () => {
    const store = makeStore(false);
    const travelHubToolRunner = vi.fn();
    const agent = vi.fn();
    const sendText = vi.fn();

    const result = await processWhatsAppInboundEvents(
      [{ ...textEvent, body: "¿Cómo va mi viaje?" }],
      { store, agent, travelHubToolRunner, sendText }
    );

    expect(result).toMatchObject({ duplicates: 1, processed: 0 });
    expect(travelHubToolRunner).not.toHaveBeenCalled();
    expect(agent).not.toHaveBeenCalled();
    expect(sendText).not.toHaveBeenCalled();
  });
});

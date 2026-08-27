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
      escalationReason: "Requiere cotización humana.",
      citedKnowledgeIds: [],
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

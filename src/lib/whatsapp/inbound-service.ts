import {
  decideWhatsAppInboundMessage,
  type WhatsAppInboundAgentDecision,
  type WhatsAppInboundAgentProvider,
  type WhatsAppKnowledgeEntry,
} from "@/lib/ai/whatsapp-inbound-agent";
import { buildWhatsAppEscalationWork } from "./escalation";
import { sendWhatsAppTextMessage, type WhatsAppSendResult } from "./client";
import {
  normalizeWhatsAppWebhookPayloadBundle,
  type NormalizedWhatsAppInboundEvent,
  type NormalizedWhatsAppStatusEvent,
} from "./normalize";
import {
  createCrmSyncEvent,
  createWhatsAppEscalation,
  insertWhatsAppOutboundMessage,
  loadWhatsAppConversationContext,
  markWhatsAppInboundMessageProcessed,
  persistWhatsAppInboundEvent,
  persistWhatsAppStatusEvents,
  updateWhatsAppConversationStatus,
  type PersistedWhatsAppInboundEvent,
  type WhatsAppStatusPersistenceResult,
  type WhatsAppStore,
} from "./store";

export type WhatsAppInboundServiceResult = {
  received: number;
  processed: number;
  duplicates: number;
  autoAnswered: number;
  escalated: number;
  sendFailures: number;
  events: WhatsAppInboundEventResult[];
};

export type WhatsAppWebhookProcessingResult = WhatsAppInboundServiceResult & {
  statusCallbacks: WhatsAppStatusPersistenceResult;
};

export type WhatsAppInboundEventResult = {
  providerMessageId: string;
  action: "duplicate_skipped" | "auto_answer" | "needs_human" | "unsupported_escalated";
  decision?: WhatsAppInboundAgentDecision;
  customerSend?: WhatsAppSendResult;
  humanAlertSend?: WhatsAppSendResult;
};

export type WhatsAppInboundServiceOptions = {
  store?: WhatsAppStore;
  agent?: typeof decideWhatsAppInboundMessage;
  agentProvider?: WhatsAppInboundAgentProvider;
  knowledgeEntries?: WhatsAppKnowledgeEntry[];
  sendText?: typeof sendWhatsAppTextMessage;
  humanAlertPhone?: string;
};

const defaultStore: WhatsAppStore = {
  persistInboundEvent: persistWhatsAppInboundEvent,
  loadConversationContext: loadWhatsAppConversationContext,
  createIntent: async (input) => {
    const { createWhatsAppIntent } = await import("./store");
    return createWhatsAppIntent(input);
  },
  insertOutboundMessage: insertWhatsAppOutboundMessage,
  createEscalation: createWhatsAppEscalation,
  createCrmSyncEvent,
  updateConversationStatus: updateWhatsAppConversationStatus,
  markInboundMessageProcessed: markWhatsAppInboundMessageProcessed,
  persistStatusEvents: persistWhatsAppStatusEvents,
};

function unsupportedDecision(event: NormalizedWhatsAppInboundEvent): WhatsAppInboundAgentDecision {
  return {
    intent: "handoff",
    summary: `Mensaje ${event.messageType} recibido por WhatsApp`,
    confidence: 1,
    decision: "needs_human",
    escalationReason: `El tipo de mensaje ${event.messageType} no es respondible automáticamente en v1.`,
    citedKnowledgeIds: [],
  };
}

async function runAgent(
  event: NormalizedWhatsAppInboundEvent,
  persisted: PersistedWhatsAppInboundEvent,
  options: WhatsAppInboundServiceOptions
) {
  if (event.messageType !== "text" || !event.body) return unsupportedDecision(event);

  const context = await (options.store ?? defaultStore).loadConversationContext(persisted.conversationId);
  return (options.agent ?? decideWhatsAppInboundMessage)(
    {
      messageText: event.body,
      contact: {
        id: persisted.contactId,
        phone: event.fromPhone,
        profileName: event.profileName,
      },
      conversation: {
        id: persisted.conversationId,
        assignedTripId: context.assignedTripId,
        lastIntent: context.lastIntent,
      },
    },
    {
      knowledgeEntries: options.knowledgeEntries,
      provider: options.agentProvider,
    }
  );
}

function countSendFailure(send?: WhatsAppSendResult) {
  return send && !send.ok ? 1 : 0;
}

export async function processWhatsAppInboundEvents(
  events: NormalizedWhatsAppInboundEvent[],
  options: WhatsAppInboundServiceOptions = {}
): Promise<WhatsAppInboundServiceResult> {
  const store = options.store ?? defaultStore;
  const sendText = options.sendText ?? sendWhatsAppTextMessage;
  const humanAlertPhone = options.humanAlertPhone ?? process.env.WHATSAPP_HUMAN_ALERT_PHONE;
  const results: WhatsAppInboundEventResult[] = [];

  let duplicates = 0;
  let autoAnswered = 0;
  let escalated = 0;
  let sendFailures = 0;

  for (const event of events) {
    const persisted = await store.persistInboundEvent(event);
    if (!persisted.inserted) {
      duplicates += 1;
      results.push({ providerMessageId: event.providerMessageId, action: "duplicate_skipped" });
      continue;
    }

    const decision = await runAgent(event, persisted, options);
    const intent = await store.createIntent({ persisted, decision });

    if (decision.decision === "auto_answer" && decision.responseText) {
      const customerSend = await sendText({
        to: event.fromPhone,
        body: decision.responseText,
        phoneNumberId: event.businessPhoneNumberId,
      });
      sendFailures += countSendFailure(customerSend);
      await store.insertOutboundMessage({
        persisted,
        purpose: "auto_answer",
        body: decision.responseText,
        status: customerSend.ok ? "sent" : "failed",
        sendResult: customerSend,
      });
      await store.updateConversationStatus({
        conversationId: persisted.conversationId,
        status: "open",
        lastIntent: decision.intent,
        lastOutboundAt: new Date().toISOString(),
      });
      await store.markInboundMessageProcessed({ messageId: persisted.messageId, status: customerSend.ok ? "responded" : "failed" });
      await store.createCrmSyncEvent({
        sourceTable: "whatsapp_messages",
        sourceId: persisted.messageId,
        eventType: "whatsapp.auto_answered",
        aggregateType: "whatsapp_conversation",
        aggregateId: persisted.conversationId,
        eventKey: `whatsapp:auto_answered:${persisted.messageId}`,
        payload: { intentId: intent.id, decision, customerSend },
      });
      autoAnswered += 1;
      results.push({ providerMessageId: event.providerMessageId, action: "auto_answer", decision, customerSend });
      continue;
    }

    const escalation = buildWhatsAppEscalationWork(event, decision);
    const customerSend = await sendText({
      to: event.fromPhone,
      body: escalation.customerFollowUpText,
      phoneNumberId: event.businessPhoneNumberId,
    });
    const humanAlertSend = humanAlertPhone
      ? await sendText({ to: humanAlertPhone, body: escalation.humanAlertText })
      : ({ ok: false, skipped: true, status: null, error: "Human WhatsApp alert phone is not configured." } satisfies WhatsAppSendResult);
    sendFailures += countSendFailure(customerSend) + countSendFailure(humanAlertSend);

    await store.insertOutboundMessage({
      persisted,
      purpose: "escalation_customer_follow_up",
      body: escalation.customerFollowUpText,
      status: customerSend.ok ? "sent" : "failed",
      sendResult: customerSend,
    });
    const escalationRecord = await store.createEscalation({ persisted, intentId: intent.id, escalation });
    await store.updateConversationStatus({
      conversationId: persisted.conversationId,
      status: "escalated",
      lastIntent: decision.intent,
      lastOutboundAt: new Date().toISOString(),
    });
    await store.markInboundMessageProcessed({ messageId: persisted.messageId, status: "escalated" });
    await store.createCrmSyncEvent({
      sourceTable: "whatsapp_escalations",
      sourceId: escalationRecord.id,
      eventType: "whatsapp.escalated",
      aggregateType: "whatsapp_conversation",
      aggregateId: persisted.conversationId,
      eventKey: `whatsapp:escalated:${persisted.messageId}`,
      payload: { intentId: intent.id, escalation, customerSend, humanAlertSend },
    });

    escalated += 1;
    results.push({
      providerMessageId: event.providerMessageId,
      action: event.messageType === "text" ? "needs_human" : "unsupported_escalated",
      decision,
      customerSend,
      humanAlertSend,
    });
  }

  return {
    received: events.length,
    processed: events.length - duplicates,
    duplicates,
    autoAnswered,
    escalated,
    sendFailures,
    events: results,
  };
}

export async function processWhatsAppStatusEvents(
  events: NormalizedWhatsAppStatusEvent[],
  options: WhatsAppInboundServiceOptions = {}
) {
  if (events.length === 0) {
    return { received: 0, inserted: 0, duplicates: 0, matched: 0, updated: 0 };
  }

  const store = options.store ?? defaultStore;
  return store.persistStatusEvents(events);
}

export async function processWhatsAppWebhookPayload(
  payload: unknown,
  options: WhatsAppInboundServiceOptions = {}
): Promise<WhatsAppWebhookProcessingResult> {
  const { inboundEvents, statusEvents } = normalizeWhatsAppWebhookPayloadBundle(payload);
  const inboundResult = await processWhatsAppInboundEvents(inboundEvents, options);
  const statusCallbacks = await processWhatsAppStatusEvents(statusEvents, options);

  return {
    ...inboundResult,
    statusCallbacks,
  };
}

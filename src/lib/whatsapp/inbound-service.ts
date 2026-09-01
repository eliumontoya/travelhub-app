import {
  buildWhatsAppCommercialEscalationDecision,
  decideWhatsAppInboundMessage,
  type WhatsAppDynamicToolResult,
  type WhatsAppInboundAgentDecision,
  type WhatsAppInboundAgentProvider,
  type WhatsAppKnowledgeEntry,
} from "@/lib/ai/whatsapp-inbound-agent";
import { runTravelHubClientTool, type TravelHubClientToolResult } from "@/lib/ai/tools/travelhub-client-tools";
import {
  createWhatsAppAiCorrelationContext,
  recordWhatsAppAiEvent,
  type WhatsAppAiCorrelationContext,
  type WhatsAppAiEventOutcome,
} from "@/lib/observability/whatsapp-ai";
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
  travelHubToolRunner?: typeof runTravelHubClientTool;
  sendText?: typeof sendWhatsAppTextMessage;
  humanAlertPhone?: string;
  observabilityContext?: WhatsAppAiCorrelationContext;
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

type DynamicTravelHubToolKind = "summary" | "itinerary" | "documents" | "payment";

function shouldUseDynamicTravelHubTools(text: string) {
  return /viaje|itinerario|agenda|actividad|hotel|vuelo|transport|document|voucher|boleto|boarding|estatus|status|c[oó]mo va|confirmad|pago|pagado|saldo|anticipo|comprobante/i.test(text);
}

function dynamicToolKindForMessage(text: string): DynamicTravelHubToolKind {
  if (/pago|pagado|saldo|anticipo|comprobante|factura/i.test(text)) return "payment";
  if (/document|voucher|boleto|boarding|pasaporte|visa/i.test(text)) return "documents";
  if (/itinerario|agenda|actividad|hotel|vuelo|transport|reserva|confirmad/i.test(text)) return "itinerary";
  return "summary";
}

function tripScopedToolForKind(kind: DynamicTravelHubToolKind) {
  if (kind === "payment") return "getTripPaymentStatus";
  if (kind === "documents") return "getTripDocumentsStatus";
  if (kind === "itinerary") return "getTripItineraryStatus";
  return "getTripSummary";
}

function toDynamicToolResult(result: TravelHubClientToolResult, index: number): WhatsAppDynamicToolResult {
  return {
    id: `${result.tool}:${index + 1}`,
    tool: result.tool,
    status: result.status,
    ...(result.data === undefined ? {} : { data: result.data }),
    ...(result.reason ? { reason: result.reason } : {}),
    ...(result.audit ? { audit: result.audit } : {}),
  };
}

function getResolvedClientId(result: TravelHubClientToolResult) {
  if (result.status !== "success" || !result.data || typeof result.data !== "object") return null;
  const clientId = (result.data as { clientId?: unknown }).clientId;
  return typeof clientId === "string" && clientId.length > 0 ? clientId : null;
}

function getSingleTripId(result: TravelHubClientToolResult) {
  if (result.status !== "success" || !result.data || typeof result.data !== "object") return null;
  const trips = (result.data as { trips?: unknown }).trips;
  if (!Array.isArray(trips) || trips.length !== 1) return null;
  const tripId = trips[0] && typeof trips[0] === "object" ? (trips[0] as { tripId?: unknown }).tripId : undefined;
  return typeof tripId === "string" && tripId.length > 0 ? tripId : null;
}

async function buildDynamicTravelHubContext(
  event: NormalizedWhatsAppInboundEvent,
  conversation: { assignedTripId?: string | null },
  options: WhatsAppInboundServiceOptions,
  observabilityContext: WhatsAppAiCorrelationContext
): Promise<WhatsAppDynamicToolResult[]> {
  if (event.messageType !== "text" || !event.body || !shouldUseDynamicTravelHubTools(event.body)) return [];

  const runTool = options.travelHubToolRunner ?? runTravelHubClientTool;
  const rawResults: TravelHubClientToolResult[] = [];
  const kind = dynamicToolKindForMessage(event.body);

  const clientResult = await runObservedTravelHubTool(
    runTool,
    { tool: "getClientByWhatsappPhone", arguments: { phone: event.fromPhone } },
    observabilityContext
  );
  rawResults.push(clientResult);
  const clientId = getResolvedClientId(clientResult);
  if (!clientId) return rawResults.map(toDynamicToolResult);

  const assignedTripId = conversation.assignedTripId ?? null;
  if (assignedTripId) {
    rawResults.push(
      await runObservedTravelHubTool(
        runTool,
        { tool: tripScopedToolForKind(kind), arguments: { clientId, tripId: assignedTripId } },
        observabilityContext
      )
    );
    return rawResults.map(toDynamicToolResult);
  }

  const tripsResult = await runObservedTravelHubTool(
    runTool,
    { tool: "getClientActiveTrips", arguments: { clientId } },
    observabilityContext
  );
  rawResults.push(tripsResult);
  const tripId = getSingleTripId(tripsResult);
  if (!tripId) return rawResults.map(toDynamicToolResult);

  rawResults.push(
    await runObservedTravelHubTool(
      runTool,
      { tool: tripScopedToolForKind(kind), arguments: { clientId, tripId } },
      observabilityContext
    )
  );
  return rawResults.map(toDynamicToolResult);
}

async function runObservedTravelHubTool(
  runTool: typeof runTravelHubClientTool,
  input: Parameters<typeof runTravelHubClientTool>[0],
  context: WhatsAppAiCorrelationContext
) {
  const startedAt = Date.now();
  try {
    const result = await runTool(input);
    recordWhatsAppAiEvent({
      context,
      type: "tool.finished",
      outcome: result.status === "error" ? "failure" : result.status === "blocked" ? "skipped" : "success",
      durationMs: Date.now() - startedAt,
      diagnostics: {
        tool: result.tool,
        status: result.status,
        reason: result.reason,
        auditOk: result.audit?.ok,
      },
    });
    return result;
  } catch (error) {
    recordWhatsAppAiEvent({
      context,
      type: "tool.finished",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      diagnostics: { tool: input.tool, error },
    });
    throw error;
  }
}

function unsupportedDecision(event: NormalizedWhatsAppInboundEvent): WhatsAppInboundAgentDecision {
  return {
    intent: "handoff",
    summary: `Mensaje ${event.messageType} recibido por WhatsApp`,
    confidence: 1,
    decision: "needs_human",
    escalationReason: `El tipo de mensaje ${event.messageType} no es respondible automáticamente en v1.`,
    citedKnowledgeIds: [],
    citedToolCallIds: [],
  };
}

async function runAgent(
  event: NormalizedWhatsAppInboundEvent,
  persisted: PersistedWhatsAppInboundEvent,
  options: WhatsAppInboundServiceOptions,
  observabilityContext: WhatsAppAiCorrelationContext
) {
  if (event.messageType !== "text" || !event.body) return unsupportedDecision(event);

  const commercialPreflight = buildWhatsAppCommercialEscalationDecision(event.body);
  if (commercialPreflight) return commercialPreflight;

  const context = await (options.store ?? defaultStore).loadConversationContext(persisted.conversationId);
  const conversation = {
    id: persisted.conversationId,
    assignedTripId: context.assignedTripId,
    lastIntent: context.lastIntent,
  };
  const dynamicToolResults = await buildDynamicTravelHubContext(event, conversation, options, observabilityContext);
  const decision = await (options.agent ?? decideWhatsAppInboundMessage)(
    {
      messageText: event.body,
      contact: {
        id: persisted.contactId,
        phone: event.fromPhone,
        profileName: event.profileName,
      },
      conversation,
      dynamicToolResults,
    },
    {
      knowledgeEntries: options.knowledgeEntries,
      provider: options.agentProvider,
      observabilityContext,
    }
  );
  return dynamicToolResults.length > 0 ? { ...decision, dynamicToolResults } : decision;
}

function countSendFailure(send?: WhatsAppSendResult) {
  return send && !send.ok ? 1 : 0;
}

function sendOutcome(send: WhatsAppSendResult): WhatsAppAiEventOutcome {
  if (send.ok) return "success";
  return send.skipped ? "skipped" : "failure";
}

function recordSendResult(
  context: WhatsAppAiCorrelationContext,
  purpose: "auto_answer" | "escalation_customer_follow_up" | "escalation_human_alert",
  send: WhatsAppSendResult
) {
  recordWhatsAppAiEvent({
    context,
    type: "send.finished",
    outcome: sendOutcome(send),
    diagnostics: {
      purpose,
      status: send.status,
      skipped: send.skipped,
      providerMessageId: send.providerMessageId,
      error: send.error,
    },
  });
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
    const observabilityContext = createWhatsAppAiCorrelationContext({
      correlationId: options.observabilityContext?.correlationId ?? event.providerMessageId,
      requestId: options.observabilityContext?.requestId,
      providerMessageId: event.providerMessageId,
    });
    const persisted = await store.persistInboundEvent(event);
    recordWhatsAppAiEvent({
      context: observabilityContext,
      type: "persistence.finished",
      outcome: persisted.inserted ? "success" : "skipped",
      diagnostics: { inserted: persisted.inserted },
    });
    if (!persisted.inserted) {
      duplicates += 1;
      recordWhatsAppAiEvent({
        context: observabilityContext,
        type: "duplicate.skipped",
        outcome: "skipped",
        identifiers: { providerMessageId: event.providerMessageId },
      });
      results.push({ providerMessageId: event.providerMessageId, action: "duplicate_skipped" });
      continue;
    }

    const decision = await runAgent(event, persisted, options, observabilityContext);
    recordWhatsAppAiEvent({
      context: observabilityContext,
      type: "ai.decision",
      outcome: decision.providerDiagnostics ? "failure" : "success",
      diagnostics: {
        intent: decision.intent,
        decision: decision.decision,
        confidence: decision.confidence,
        hasProviderDiagnostics: Boolean(decision.providerDiagnostics),
        citedKnowledgeCount: decision.citedKnowledgeIds.length,
        citedToolCallCount: decision.citedToolCallIds.length,
        providerDiagnostics: decision.providerDiagnostics,
      },
    });
    const intent = await store.createIntent({ persisted, decision });

    if (decision.decision === "auto_answer" && decision.responseText) {
      const customerSend = await sendText({
        to: event.fromPhone,
        body: decision.responseText,
        phoneNumberId: event.businessPhoneNumberId,
      });
      recordSendResult(observabilityContext, "auto_answer", customerSend);
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
    recordSendResult(observabilityContext, "escalation_customer_follow_up", customerSend);
    const humanAlertSend = humanAlertPhone
      ? await sendText({ to: humanAlertPhone, body: escalation.humanAlertText })
      : ({ ok: false, skipped: true, status: null, error: "Human WhatsApp alert phone is not configured." } satisfies WhatsAppSendResult);
    recordSendResult(observabilityContext, "escalation_human_alert", humanAlertSend);
    sendFailures += countSendFailure(customerSend) + countSendFailure(humanAlertSend);

    await store.insertOutboundMessage({
      persisted,
      purpose: "escalation_customer_follow_up",
      body: escalation.customerFollowUpText,
      status: customerSend.ok ? "sent" : "failed",
      sendResult: customerSend,
    });
    await store.insertOutboundMessage({
      persisted,
      purpose: "escalation_human_alert",
      body: escalation.humanAlertText,
      status: humanAlertSend.ok ? "sent" : "failed",
      sendResult: humanAlertSend,
    });
    const escalationRecord = await store.createEscalation({ persisted, intentId: intent.id, escalation });
    recordWhatsAppAiEvent({
      context: observabilityContext,
      type: "escalation.created",
      outcome: "success",
      identifiers: { escalationId: escalationRecord.id },
      diagnostics: { intent: decision.intent },
    });
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
  const result = await store.persistStatusEvents(events);
  for (const event of events) {
    recordWhatsAppAiEvent({
      context: createWhatsAppAiCorrelationContext({
        correlationId: options.observabilityContext?.correlationId ?? event.providerMessageId,
        requestId: options.observabilityContext?.requestId,
        providerMessageId: event.providerMessageId,
      }),
      type: "status_callback.persisted",
      outcome: "success",
      diagnostics: { status: event.status },
    });
  }
  return result;
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

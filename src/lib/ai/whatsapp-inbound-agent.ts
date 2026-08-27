import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createWhatsAppLLMProvider } from "./whatsapp-llm-provider";

export type WhatsAppInboundIntent =
  | "inquiry"
  | "quote_request"
  | "existing_trip"
  | "support"
  | "handoff"
  | "unknown";

export type WhatsAppInboundDecisionType = "auto_answer" | "needs_human";

export type WhatsAppKnowledgeEntry = {
  id: string;
  topic: string;
  question: string;
  answer: string;
  tags: string[];
  source: string | null;
};

export type WhatsAppInboundAgentInput = {
  messageText: string;
  contact?: {
    id?: string;
    phone?: string;
    profileName?: string;
  };
  conversation?: {
    id?: string;
    assignedTripId?: string | null;
    lastIntent?: string | null;
  };
};

export type WhatsAppInboundAgentProviderInput = WhatsAppInboundAgentInput & {
  knowledgeEntries: WhatsAppKnowledgeEntry[];
};

export type WhatsAppInboundAgentProvider = (
  input: WhatsAppInboundAgentProviderInput
) => Promise<unknown> | unknown;

export type WhatsAppInboundAgentDiagnostics = {
  providerErrorType: "invalid_json" | "invalid_structured_output";
  rawOutputPreview?: string;
  validationIssues?: Array<{ path: string; message: string }>;
};

export type WhatsAppInboundAgentDecision = {
  intent: WhatsAppInboundIntent;
  summary: string;
  confidence: number;
  decision: WhatsAppInboundDecisionType;
  responseText?: string;
  escalationReason?: string;
  citedKnowledgeIds: string[];
  providerDiagnostics?: WhatsAppInboundAgentDiagnostics;
};

type WhatsAppSupabaseClient = Pick<SupabaseClient, "from">;

const SAFE_AUTO_ANSWER_CONFIDENCE = 0.7;
const KNOWLEDGE_LIMIT = 25;

const optionalProviderString = (maxLength: number) =>
  z.preprocess((value) => (value === null ? undefined : value), z.string().trim().min(1).max(maxLength).optional());

const providerOutputSchema = z.object({
  intent: z.enum(["inquiry", "quote_request", "existing_trip", "support", "handoff", "unknown"]),
  summary: z.string().trim().min(1).max(500),
  confidence: z.number().min(0).max(1),
  decision: z.enum(["auto_answer", "needs_human"]),
  responseText: optionalProviderString(2000),
  escalationReason: optionalProviderString(1000),
  citedKnowledgeIds: z.array(z.string().trim().min(1)).default([]),
});

function safeEscalation(
  intent: WhatsAppInboundIntent,
  summary: string,
  escalationReason: string,
  confidence = 0,
  providerDiagnostics?: WhatsAppInboundAgentDiagnostics
): WhatsAppInboundAgentDecision {
  return {
    intent,
    summary,
    confidence,
    decision: "needs_human",
    escalationReason,
    citedKnowledgeIds: [],
    ...(providerDiagnostics ? { providerDiagnostics } : {}),
  };
}

function createDefaultKnowledgeClient(): WhatsAppSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeKnowledgeEntry(row: Record<string, unknown>): WhatsAppKnowledgeEntry | null {
  if (
    typeof row.id !== "string" ||
    typeof row.topic !== "string" ||
    typeof row.question !== "string" ||
    typeof row.answer !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    topic: row.topic,
    question: row.question,
    answer: row.answer,
    tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
    source: typeof row.source === "string" ? row.source : null,
  };
}

export async function loadApprovedWhatsAppKnowledgeEntries(
  client: WhatsAppSupabaseClient | null = createDefaultKnowledgeClient()
): Promise<WhatsAppKnowledgeEntry[]> {
  if (!client) return [];

  try {
    const result = await client
      .from("whatsapp_knowledge_entries")
      .select("id, topic, question, answer, tags, source")
      .eq("status", "approved")
      .order("approved_at", { ascending: false, nullsFirst: false })
      .limit(KNOWLEDGE_LIMIT);

    if (result.error || !Array.isArray(result.data)) return [];
    return result.data
      .map((row) => normalizeKnowledgeEntry(row as Record<string, unknown>))
      .filter((entry): entry is WhatsAppKnowledgeEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function hasAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function preflightEscalation(messageText: string): WhatsAppInboundAgentDecision | null {
  const trimmed = messageText.trim();
  if (!trimmed) {
    return safeEscalation("unknown", "Mensaje vacío", "El mensaje está vacío o no contiene texto suficiente.");
  }

  const normalized = trimmed.toLowerCase();
  const sensitivePatterns = [
    /emergencia|urgente|m[eé]dic|hospital|accidente|legal|abogado|demanda|pasaporte perdido|perd[ií].*(documento|pasaporte)/i,
  ];
  const commercialPatterns = [
    /cotiz|precio|cu[aá]nto cuesta|costo|reserv|pagar|pago|anticipo|cancel|reembolso|factura|cambiar.*vuelo|confirmar.*compra/i,
  ];

  if (hasAny(normalized, sensitivePatterns)) {
    return safeEscalation(
      "support",
      trimmed.slice(0, 180),
      "El mensaje parece sensible o urgente y debe atenderlo un agente humano."
    );
  }

  if (hasAny(normalized, commercialPatterns)) {
    return safeEscalation(
      "quote_request",
      trimmed.slice(0, 180),
      "El mensaje solicita una acción comercial específica que debe revisar un agente humano."
    );
  }

  return null;
}

function extractJsonObjectString(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("```")) {
    const withoutFence = trimmed
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    if (withoutFence.startsWith("{") && withoutFence.endsWith("}")) return withoutFence;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  return trimmed;
}

function canonicalizeProviderOutput(output: unknown): unknown {
  if (!output || typeof output !== "object" || Array.isArray(output)) return output;

  const candidate = { ...(output as Record<string, unknown>) };
  const intent = typeof candidate.intent === "string" ? candidate.intent.toLowerCase().trim() : "";
  const decision = typeof candidate.decision === "string" ? candidate.decision.toLowerCase().trim() : "";

  const intentMap: Record<string, WhatsAppInboundIntent> = {
    faq: "inquiry",
    general: "inquiry",
    question: "inquiry",
    schedule: "inquiry",
    schedule_inquiry: "inquiry",
    hours: "inquiry",
    hours_inquiry: "inquiry",
    services: "inquiry",
    service_inquiry: "inquiry",
    pricing: "quote_request",
    quote: "quote_request",
    quotation: "quote_request",
    trip_status: "existing_trip",
    status: "existing_trip",
    existing_customer: "existing_trip",
    human: "handoff",
    human_handoff: "handoff",
    escalation: "handoff",
  };

  const decisionMap: Record<string, WhatsAppInboundDecisionType> = {
    answer: "auto_answer",
    direct_answer: "auto_answer",
    respond: "auto_answer",
    response: "auto_answer",
    auto: "auto_answer",
    autoanswer: "auto_answer",
    "auto-answer": "auto_answer",
    escalate: "needs_human",
    escalation: "needs_human",
    handoff: "needs_human",
    human: "needs_human",
    needs_handoff: "needs_human",
  };

  if (intentMap[intent]) candidate.intent = intentMap[intent];
  if (decisionMap[decision]) candidate.decision = decisionMap[decision];

  return candidate;
}

const RAW_OUTPUT_PREVIEW_LIMIT = 1000;

function previewProviderOutput(output: unknown) {
  try {
    const raw = typeof output === "string" ? output : JSON.stringify(output);
    return raw.length > RAW_OUTPUT_PREVIEW_LIMIT ? `${raw.slice(0, RAW_OUTPUT_PREVIEW_LIMIT)}…` : raw;
  } catch {
    return undefined;
  }
}

function formatValidationIssues(error: z.ZodError) {
  return error.issues.slice(0, 10).map((issue) => ({
    path: issue.path.map(String).join(".") || "root",
    message: issue.message,
  }));
}

function invalidJsonDiagnostics(output: unknown): WhatsAppInboundAgentDiagnostics {
  return {
    providerErrorType: "invalid_json",
    rawOutputPreview: previewProviderOutput(output),
  };
}

function parseProviderOutput(output: unknown):
  | { success: true; data: z.infer<typeof providerOutputSchema> }
  | { success: false; diagnostics: WhatsAppInboundAgentDiagnostics } {
  let parsedOutput: unknown;
  try {
    parsedOutput = typeof output === "string" ? JSON.parse(extractJsonObjectString(output)) : output;
  } catch {
    return { success: false, diagnostics: invalidJsonDiagnostics(output) };
  }

  const result = providerOutputSchema.safeParse(canonicalizeProviderOutput(parsedOutput));
  if (result.success) return { success: true, data: result.data };

  return {
    success: false,
    diagnostics: {
      providerErrorType: "invalid_structured_output",
      rawOutputPreview: previewProviderOutput(output),
      validationIssues: formatValidationIssues(result.error),
    },
  };
}

async function defaultProvider() {
  return {
    intent: "unknown",
    summary: "No hay proveedor de decisión configurado.",
    confidence: 0,
    decision: "needs_human",
    escalationReason: "No hay proveedor de decisión configurado.",
    citedKnowledgeIds: [],
  };
}

export async function decideWhatsAppInboundMessage(
  input: WhatsAppInboundAgentInput,
  options: {
    knowledgeEntries?: WhatsAppKnowledgeEntry[];
    provider?: WhatsAppInboundAgentProvider;
  } = {}
): Promise<WhatsAppInboundAgentDecision> {
  const preflight = preflightEscalation(input.messageText);
  if (preflight) return preflight;

  const knowledgeEntries = options.knowledgeEntries ?? (await loadApprovedWhatsAppKnowledgeEntries());
  if (knowledgeEntries.length === 0) {
    return safeEscalation(
      "unknown",
      input.messageText.trim().slice(0, 180),
      "No hay conocimiento aprobado suficiente para responder automáticamente."
    );
  }

  const provider = options.provider ?? createWhatsAppLLMProvider() ?? defaultProvider;
  let providerOutput: unknown;
  try {
    providerOutput = await provider({ ...input, messageText: input.messageText.trim(), knowledgeEntries });
  } catch (error) {
    return safeEscalation(
      "unknown",
      input.messageText.trim().slice(0, 180),
      "El proveedor de decisión falló antes de devolver una salida.",
      0,
      {
        providerErrorType: "invalid_json",
        rawOutputPreview: error instanceof Error ? error.message : undefined,
      }
    );
  }

  const parsed = parseProviderOutput(providerOutput);
  if (!parsed.success) {
    return safeEscalation(
      "unknown",
      input.messageText.trim().slice(0, 180),
      parsed.diagnostics.providerErrorType === "invalid_json"
        ? "La salida del proveedor no fue JSON válido."
        : "La salida estructurada del proveedor no es válida.",
      0,
      parsed.diagnostics
    );
  }

  const output = parsed.data;
  if (output.decision === "needs_human") {
    return {
      intent: output.intent,
      summary: output.summary,
      confidence: output.confidence,
      decision: "needs_human",
      escalationReason: output.escalationReason ?? "El proveedor solicitó revisión humana.",
      citedKnowledgeIds: output.citedKnowledgeIds,
    };
  }

  const approvedIds = new Set(knowledgeEntries.map((entry) => entry.id));
  const citesApprovedKnowledge =
    output.citedKnowledgeIds.length > 0 && output.citedKnowledgeIds.every((id) => approvedIds.has(id));
  if (!output.responseText || !citesApprovedKnowledge) {
    return safeEscalation(
      output.intent,
      output.summary,
      "Una respuesta automática debe citar conocimiento aprobado.",
      output.confidence
    );
  }

  if (output.confidence < SAFE_AUTO_ANSWER_CONFIDENCE) {
    return safeEscalation(
      output.intent,
      output.summary,
      "La confianza del agente está por debajo del umbral seguro para auto-responder.",
      output.confidence
    );
  }

  return {
    intent: output.intent,
    summary: output.summary,
    confidence: output.confidence,
    decision: "auto_answer",
    responseText: output.responseText,
    citedKnowledgeIds: output.citedKnowledgeIds,
  };
}

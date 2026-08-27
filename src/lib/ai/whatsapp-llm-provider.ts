import type {
  WhatsAppInboundAgentProvider,
  WhatsAppInboundAgentProviderInput,
  WhatsAppKnowledgeEntry,
} from "./whatsapp-inbound-agent";

type ChatCompletionMessage = {
  role: "system" | "user";
  content: string;
};

type WhatsAppLLMProviderApiStyle = "chat_completions" | "responses";

type WhatsAppLLMProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  apiStyle?: WhatsAppLLMProviderApiStyle;
  timeoutMs?: number;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_TIMEOUT_MS = 12_000;

function compactKnowledge(entries: WhatsAppKnowledgeEntry[]) {
  return entries.map((entry) => ({
    id: entry.id,
    topic: entry.topic,
    question: entry.question,
    answer: entry.answer,
    tags: entry.tags,
  }));
}

function buildSystemPrompt() {
  return `Eres el agente de WhatsApp de TravelHub.

Tu tarea es decidir si puedes responder automáticamente una pregunta usando SOLO el conocimiento aprobado proporcionado y/o resultados seguros de tools dinámicas de TravelHub ya ejecutadas por el servidor.

Reglas obligatorias:
- Responde únicamente en español.
- No inventes información.
- No prometas precios, disponibilidad, reservaciones, reembolsos, cambios, pagos, facturación ni confirmaciones específicas.
- Nunca menciones SQL, Supabase, tablas, credenciales, service role, herramientas internas ni errores técnicos al cliente.
- Si hay dynamicToolResults, ya fueron ejecutados de forma segura por el servidor: solo puedes usar su payload minimizado.
- Si un dynamicToolResult tiene status success, puedes responder usando ese dato si citas su id en citedToolCallIds.
- Si un dynamicToolResult tiene status ambiguous, pide al cliente aclarar cuál viaje de las opciones quiere revisar.
- Si un dynamicToolResult tiene status not_found, blocked, error o needs_human, no des datos privados: responde empáticamente y pide seguimiento humano cuando corresponda.
- Si la pregunta requiere revisar datos internos del cliente o del viaje y no hay dynamicToolResults suficientes, responde con needs_human.
- Si no hay una entrada de conocimiento aprobada ni un tool dinámico exitoso que soporte directamente la respuesta, responde con needs_human.
- Si decides auto_answer, debes incluir al menos un id de conocimiento aprobado en citedKnowledgeIds o un id de tool exitoso en citedToolCallIds.
- La respuesta al cliente debe ser breve, clara y profesional. Y siempre da las gracias por contactarnos, por su confianza, por su paciencia, etc. de acuerdo a lo que aplique.
- Cuando respondas con needs_human, incluye en responseText una respuesta breve, empática y relacionada con la pregunta del cliente: reconoce su necesidad, responde lo humanamente posible sin comprometer datos no confirmados, e indica que un asesor dará seguimiento.


Debes responder exclusivamente JSON válido con esta forma:
{
  "intent": "inquiry" | "quote_request" | "existing_trip" | "support" | "handoff" | "unknown",
  "summary": "resumen breve del mensaje",
  "confidence": 0.0,
  "decision": "auto_answer" | "needs_human",
  "responseText": "respuesta breve al cliente; obligatoria para auto_answer y recomendada para needs_human",
  "escalationReason": "solo si decision es needs_human",
  "citedKnowledgeIds": ["ids de conocimiento usados"],
  "citedToolCallIds": ["ids de tools dinámicos usados"]
}`;
}

function buildUserPrompt(input: WhatsAppInboundAgentProviderInput) {
  return JSON.stringify(
    {
      messageText: input.messageText,
      contact: input.contact ?? null,
      conversation: input.conversation ?? null,
      approvedKnowledge: compactKnowledge(input.knowledgeEntries),
      dynamicToolResults: input.dynamicToolResults ?? [],
    },
    null,
    2
  );
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

function inferApiStyle(baseUrl: string, configured?: string): WhatsAppLLMProviderApiStyle {
  if (configured === "responses" || configured === "chat_completions") return configured;
  return /\/responses$/.test(baseUrl) ? "responses" : "chat_completions";
}

function resolveEndpoint(baseUrl: string, apiStyle: WhatsAppLLMProviderApiStyle) {
  if (apiStyle === "responses") {
    return /\/responses$/.test(baseUrl) ? baseUrl : `${baseUrl}/responses`;
  }
  return /\/chat\/completions$/.test(baseUrl) ? baseUrl : `${baseUrl}/chat/completions`;
}

async function parseResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("application/json") ? response.json() : response.text();
}

function extractChatCompletionContent(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : null;
}

function extractResponsesContent(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const directText = (body as { output_text?: unknown }).output_text;
  if (typeof directText === "string") return directText;

  const output = (body as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;

  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === "string") return text;
    }
  }

  return null;
}

function extractAssistantContent(body: unknown, apiStyle: WhatsAppLLMProviderApiStyle): string | null {
  return apiStyle === "responses" ? extractResponsesContent(body) : extractChatCompletionContent(body);
}

function buildRequestBody(apiStyle: WhatsAppLLMProviderApiStyle, model: string, messages: ChatCompletionMessage[]) {
  if (apiStyle === "responses") {
    return {
      model,
      input: messages,
      temperature: 0.1,
    };
  }

  return {
    model,
    messages,
    temperature: 0.1,
    response_format: { type: "json_object" },
  };
}

export function createWhatsAppLLMProvider(config: WhatsAppLLMProviderConfig = {}): WhatsAppInboundAgentProvider | null {
  const apiKey = config.apiKey ?? process.env.WHATSAPP_AGENT_LLM_API_KEY;
  const model = config.model ?? process.env.WHATSAPP_AGENT_LLM_MODEL;
  const baseUrl = normalizeBaseUrl(config.baseUrl ?? process.env.WHATSAPP_AGENT_LLM_BASE_URL ?? DEFAULT_BASE_URL);
  const apiStyle = inferApiStyle(baseUrl, config.apiStyle ?? process.env.WHATSAPP_AGENT_LLM_API_STYLE);
  const endpoint = resolveEndpoint(baseUrl, apiStyle);
  const timeoutMs = config.timeoutMs ?? Number(process.env.WHATSAPP_AGENT_LLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  if (!apiKey || !model) return null;

  return async function whatsappLLMProvider(input: WhatsAppInboundAgentProviderInput) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS);

    const messages: ChatCompletionMessage[] = [
      { role: "system", content: buildSystemPrompt() },
      { role: "user", content: buildUserPrompt(input) },
    ];

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(buildRequestBody(apiStyle, model, messages)),
      });

      const body = await parseResponse(response);
      if (!response.ok) {
        return {
          intent: "unknown",
          summary: input.messageText.slice(0, 180),
          confidence: 0,
          decision: "needs_human",
          escalationReason: `El proveedor LLM falló con status ${response.status}.`,
          citedKnowledgeIds: [],
        };
      }

      const content = extractAssistantContent(body, apiStyle);
      if (!content) {
        return {
          intent: "unknown",
          summary: input.messageText.slice(0, 180),
          confidence: 0,
          decision: "needs_human",
          escalationReason: "El proveedor LLM no devolvió contenido utilizable.",
          citedKnowledgeIds: [],
        };
      }

      return content;
    } catch (error) {
      return {
        intent: "unknown",
        summary: input.messageText.slice(0, 180),
        confidence: 0,
        decision: "needs_human",
        escalationReason: error instanceof Error ? `El proveedor LLM falló: ${error.message}` : "El proveedor LLM falló.",
        citedKnowledgeIds: [],
      };
    } finally {
      clearTimeout(timeout);
    }
  };
}

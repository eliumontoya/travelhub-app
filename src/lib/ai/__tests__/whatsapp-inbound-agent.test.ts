import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decideWhatsAppInboundMessage,
  loadApprovedWhatsAppKnowledgeEntries,
  type WhatsAppInboundAgentProvider,
  type WhatsAppKnowledgeEntry,
} from "@/lib/ai/whatsapp-inbound-agent";

const approvedKnowledge: WhatsAppKnowledgeEntry[] = [
  {
    id: "knowledge-1",
    topic: "calendario",
    question: "¿Cuál es el horario de atención?",
    answer: "Atendemos de lunes a viernes de 9:00 a 18:00 y sábados de 10:00 a 14:00.",
    tags: ["horarios"],
    source: "manual",
  },
];

function providerReturning(output: unknown): WhatsAppInboundAgentProvider {
  return vi.fn(async () => output);
}

describe("decideWhatsAppInboundMessage", () => {
  it("auto-answers when approved knowledge directly supports the provider output", async () => {
    const provider = providerReturning({
      intent: "inquiry",
      summary: "Pregunta por horario de atención",
      confidence: 0.91,
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
      citedKnowledgeIds: ["knowledge-1"],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Hola, ¿cuál es su horario de atención?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toEqual({
      intent: "inquiry",
      summary: "Pregunta por horario de atención",
      confidence: 0.91,
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
      citedKnowledgeIds: ["knowledge-1"],
    });
    expect(provider).toHaveBeenCalledWith(
      expect.objectContaining({
        messageText: "Hola, ¿cuál es su horario de atención?",
        knowledgeEntries: approvedKnowledge,
      })
    );
  });



  it("accepts empty optional provider fields and still auto-answers safely", async () => {
    const provider = providerReturning({
      intent: "inquiry",
      summary: "Pregunta por servicios generales",
      confidence: 0.91,
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
      escalationReason: "   ",
      citedKnowledgeIds: ["knowledge-1"],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Hola, ¿qué servicios ofrecen?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "inquiry",
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
    });
  });

  it("accepts null optional provider fields and still auto-answers safely", async () => {
    const provider = providerReturning({
      intent: "inquiry",
      summary: "Pregunta por horario de atención",
      confidence: 0.91,
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
      escalationReason: null,
      citedKnowledgeIds: ["knowledge-1"],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Hola, ¿cuál es su horario de atención?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "inquiry",
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
    });
  });

  it("canonicalizes common provider enum synonyms before enforcing safety gates", async () => {
    const provider = providerReturning({
      intent: "schedule_inquiry",
      summary: "Pregunta por horario de atención",
      confidence: 0.91,
      decision: "direct_answer",
      responseText: approvedKnowledge[0].answer,
      citedKnowledgeIds: ["knowledge-1"],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Hola, ¿cuál es su horario de atención?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "inquiry",
      confidence: 0.91,
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
      citedKnowledgeIds: ["knowledge-1"],
    });
  });

  it("extracts JSON objects from fenced provider output", async () => {
    const provider = providerReturning(
      `Here is the JSON:
\`\`\`json
${JSON.stringify({
        intent: "faq",
        summary: "Pregunta por horario de atención",
        confidence: 0.91,
        decision: "answer",
        responseText: approvedKnowledge[0].answer,
        citedKnowledgeIds: ["knowledge-1"],
      })}
\`\`\``
    );

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Hola, ¿cuál es su horario de atención?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "inquiry",
      decision: "auto_answer",
    });
  });

  it("escalates when approved knowledge is insufficient", async () => {
    const provider = providerReturning({
      intent: "unknown",
      summary: "Pregunta no cubierta",
      confidence: 0.2,
      decision: "needs_human",
      escalationReason: "No hay conocimiento aprobado suficiente para responder.",
      citedKnowledgeIds: [],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "¿Me puedes recomendar un hotel pet friendly en Tokio?" },
      { knowledgeEntries: [], provider }
    );

    expect(result.decision).toBe("needs_human");
    expect(result.responseText).toBeUndefined();
    expect(result.escalationReason).toMatch(/conocimiento aprobado/i);
    expect(provider).not.toHaveBeenCalled();
  });

  it("escalates commercial-specific requests before calling the provider", async () => {
    const provider = providerReturning({ decision: "auto_answer" });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Quiero reservar y pagar el viaje a Japón, ¿cuánto cuesta?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "quote_request",
      decision: "needs_human",
    });
    expect(result.escalationReason).toMatch(/agente humano/i);
    expect(provider).not.toHaveBeenCalled();
  });

  it("escalates sensitive support requests before calling the provider", async () => {
    const provider = providerReturning({ decision: "auto_answer" });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Tengo una emergencia médica durante mi viaje, ¿qué hago?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "support",
      decision: "needs_human",
    });
    expect(result.escalationReason).toMatch(/sensible|urgente/i);
    expect(provider).not.toHaveBeenCalled();
  });

  it("returns safe diagnostics when provider output fails schema validation", async () => {
    const provider = providerReturning({
      intent: "destination_info",
      summary: "Pregunta por servicios y destino",
      confidence: 0.9,
      decision: "direct_answer",
      responseText: approvedKnowledge[0].answer,
      citedKnowledgeIds: ["knowledge-1"],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "Quiero información de servicios para Metepec" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "unknown",
      decision: "needs_human",
      escalationReason: "La salida estructurada del proveedor no es válida.",
      providerDiagnostics: {
        providerErrorType: "invalid_structured_output",
        rawOutputPreview: expect.stringContaining("destination_info"),
        validationIssues: expect.arrayContaining([
          expect.objectContaining({ path: "intent" }),
        ]),
      },
    });
  });

  it("returns safe diagnostics when provider output is not JSON", async () => {
    const provider = providerReturning("no soy json");

    const result = await decideWhatsAppInboundMessage(
      { messageText: "¿Qué servicios ofrecen?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      decision: "needs_human",
      escalationReason: "La salida del proveedor no fue JSON válido.",
      providerDiagnostics: {
        providerErrorType: "invalid_json",
        rawOutputPreview: "no soy json",
      },
    });
  });

  it("validates malformed provider JSON and returns safe escalation", async () => {
    const provider = providerReturning("{not-json");

    const result = await decideWhatsAppInboundMessage(
      { messageText: "¿Cuál es su horario?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result).toMatchObject({
      intent: "unknown",
      decision: "needs_human",
    });
    expect(result.escalationReason).toMatch(/salida/i);
  });

  it("converts unsafe auto-answer output to needs_human", async () => {
    const provider = providerReturning({
      intent: "inquiry",
      summary: "Dice saber algo sin citar conocimiento",
      confidence: 0.95,
      decision: "auto_answer",
      responseText: "Claro, el viaje cuesta 1000 USD.",
      citedKnowledgeIds: [],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "¿Cuál es su horario?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result.decision).toBe("needs_human");
    expect(result.responseText).toBeUndefined();
    expect(result.escalationReason).toMatch(/citar conocimiento aprobado/i);
  });

  it("rejects auto-answer citations that include non-approved knowledge ids", async () => {
    const provider = providerReturning({
      intent: "inquiry",
      summary: "Cita conocimiento mezclado",
      confidence: 0.95,
      decision: "auto_answer",
      responseText: approvedKnowledge[0].answer,
      citedKnowledgeIds: ["knowledge-1", "draft-knowledge"],
    });

    const result = await decideWhatsAppInboundMessage(
      { messageText: "¿Cuál es su horario?" },
      { knowledgeEntries: approvedKnowledge, provider }
    );

    expect(result.decision).toBe("needs_human");
    expect(result.escalationReason).toMatch(/conocimiento aprobado/i);
  });
});

describe("loadApprovedWhatsAppKnowledgeEntries", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("queries only approved knowledge entries with a bounded read", async () => {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      limit: vi.fn(async () => ({ data: [approvedKnowledge[0]], error: null })),
    };
    const client = { from: vi.fn(() => query) } as unknown as Pick<SupabaseClient, "from">;

    const result = await loadApprovedWhatsAppKnowledgeEntries(client);

    expect(result).toEqual(approvedKnowledge);
    expect(client.from).toHaveBeenCalledWith("whatsapp_knowledge_entries");
    expect(query.select).toHaveBeenCalledWith("id, topic, question, answer, tags, source");
    expect(query.eq).toHaveBeenCalledWith("status", "approved");
    expect(query.order).toHaveBeenCalledWith("approved_at", { ascending: false, nullsFirst: false });
    expect(query.limit).toHaveBeenCalledWith(25);
  });

  it("degrades to empty knowledge when Supabase config is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");

    await expect(loadApprovedWhatsAppKnowledgeEntries()).resolves.toEqual([]);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createWhatsAppLLMProvider } from "@/lib/ai/whatsapp-llm-provider";
import type { WhatsAppKnowledgeEntry } from "@/lib/ai/whatsapp-inbound-agent";

const knowledge: WhatsAppKnowledgeEntry[] = [
  {
    id: "knowledge-hours",
    topic: "horarios",
    question: "¿Cuál es el horario?",
    answer: "Atendemos de lunes a viernes de 9:00 a 18:00.",
    tags: ["horarios"],
    source: "test",
  },
];

describe("createWhatsAppLLMProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when credentials are missing", () => {
    expect(createWhatsAppLLMProvider({ apiKey: "", model: "" })).toBeNull();
  });

  it("calls an OpenAI-compatible chat completions endpoint and returns assistant JSON", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intent: "inquiry",
                  summary: "Pregunta por horarios",
                  confidence: 0.92,
                  decision: "auto_answer",
                  responseText: knowledge[0].answer,
                  citedKnowledgeIds: ["knowledge-hours"],
                }),
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const provider = createWhatsAppLLMProvider({
      apiKey: "test-key",
      model: "test-model",
      baseUrl: "https://llm.example/v1/",
      timeoutMs: 5000,
    });

    await expect(
      provider?.({ messageText: "¿Cuál es su horario?", knowledgeEntries: knowledge })
    ).resolves.toMatch(/auto_answer/);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://llm.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      })
    );
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("test-model");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(JSON.stringify(body.messages)).toContain("knowledge-hours");
    expect(JSON.stringify(body.messages)).toContain("needs_human");
    expect(JSON.stringify(body.messages)).toContain("empática");
  });

  it("supports Responses API endpoints such as OpenCode Zen GPT models", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          output_text: JSON.stringify({
            intent: "inquiry",
            summary: "Pregunta por horarios",
            confidence: 0.9,
            decision: "auto_answer",
            responseText: knowledge[0].answer,
            citedKnowledgeIds: ["knowledge-hours"],
          }),
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );

    const provider = createWhatsAppLLMProvider({
      apiKey: "test-key",
      model: "gpt-5.4-mini",
      baseUrl: "https://opencode.ai/zen/v1/responses",
      timeoutMs: 5000,
    });

    await expect(provider?.({ messageText: "¿Cuál es su horario?", knowledgeEntries: knowledge })).resolves.toMatch(
      /auto_answer/
    );

    expect(fetchSpy).toHaveBeenCalledWith("https://opencode.ai/zen/v1/responses", expect.any(Object));
    const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("gpt-5.4-mini");
    expect(body.input).toHaveLength(2);
    expect(body.response_format).toBeUndefined();
  });

  it("degrades to needs_human when the provider request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "bad" }), { status: 500 }));

    const provider = createWhatsAppLLMProvider({ apiKey: "test-key", model: "test-model" });

    await expect(provider?.({ messageText: "Hola", knowledgeEntries: knowledge })).resolves.toMatchObject({
      decision: "needs_human",
      escalationReason: "El proveedor LLM falló con status 500.",
    });
  });
});

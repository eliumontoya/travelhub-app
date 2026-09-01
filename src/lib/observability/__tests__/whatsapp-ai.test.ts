import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createWhatsAppAiCorrelationContext,
  getWhatsAppAiObservabilitySnapshot,
  recordWhatsAppAiEvent,
  resetWhatsAppAiObservabilityForTests,
  sanitizeWhatsAppAiDiagnostics,
} from "@/lib/observability/whatsapp-ai";

describe("WhatsApp AI observability", () => {
  beforeEach(() => {
    resetWhatsAppAiObservabilityForTests();
  });

  it("keeps stable correlation ids and unique event ids", () => {
    const context = createWhatsAppAiCorrelationContext({ providerMessageId: "wamid.in-1" });
    const first = recordWhatsAppAiEvent({ context, type: "webhook.accepted", outcome: "success" });
    const second = recordWhatsAppAiEvent({ context, type: "ai.decision", outcome: "success", diagnostics: { decision: "auto_answer" } });

    expect(first.correlationId).toBe("wamid.in-1");
    expect(second.correlationId).toBe("wamid.in-1");
    expect(first.eventId).not.toBe(second.eventId);
    expect(getWhatsAppAiObservabilitySnapshot().metrics.totalEvents).toBe(2);
  });

  it("redacts secrets, phone numbers, prompts, completions, raw payloads, URLs, SQL, and stack traces", () => {
    const unsafe = sanitizeWhatsAppAiDiagnostics({
      Authorization: "Bearer sk-secret-token",
      phone: "+52 15551234567",
      messageText: "Mi teléfono es 5215551234567 y mi viaje privado está en https://privado.test/t/x",
      prompt: "system prompt privado",
      completion: "respuesta privada",
      rawBody: { entry: [{ secret: "SUPABASE_SERVICE_ROLE_KEY" }] },
      sql: "select * from clients where phone = '5215551234567'",
      stack: "Error: boom\n at secret.ts:1:1",
    });
    const serialized = JSON.stringify(unsafe);

    expect(serialized).not.toContain("sk-secret-token");
    expect(serialized).not.toContain("5215551234567");
    expect(serialized).not.toContain("system prompt privado");
    expect(serialized).not.toContain("respuesta privada");
    expect(serialized).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(serialized).not.toContain("select * from clients");
    expect(serialized).not.toContain("secret.ts");
    expect(serialized).not.toContain("https://privado.test");
    expect(serialized).toContain("[redacted");
  });

  it("derives operational metrics and recent failures from sanitized events", () => {
    const context = createWhatsAppAiCorrelationContext({ correlationId: "corr-1" });

    recordWhatsAppAiEvent({ context, type: "duplicate.skipped", outcome: "skipped" });
    recordWhatsAppAiEvent({ context, type: "ai.decision", outcome: "success", diagnostics: { decision: "needs_human" } });
    recordWhatsAppAiEvent({ context, type: "send.finished", outcome: "failure", diagnostics: { error: "Bearer token failed for 5215551234567" } });
    recordWhatsAppAiEvent({ context, type: "escalation.created", outcome: "success" });

    const snapshot = getWhatsAppAiObservabilitySnapshot();

    expect(snapshot.metrics.duplicates).toBe(1);
    expect(snapshot.metrics.needsHuman).toBe(1);
    expect(snapshot.metrics.sendFailures).toBe(1);
    expect(snapshot.metrics.escalations).toBe(1);
    expect(snapshot.recentFailures).toHaveLength(1);
    expect(JSON.stringify(snapshot.recentFailures[0])).not.toContain("5215551234567");
    expect(JSON.stringify(snapshot.recentFailures[0])).not.toContain("Bearer token");
  });

  it("never throws when the console sink fails", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {
      throw new Error("console unavailable");
    });

    expect(() => recordWhatsAppAiEvent({ type: "webhook.accepted", outcome: "success" })).not.toThrow();
    expect(getWhatsAppAiObservabilitySnapshot().metrics.totalEvents).toBe(1);
    spy.mockRestore();
  });
});

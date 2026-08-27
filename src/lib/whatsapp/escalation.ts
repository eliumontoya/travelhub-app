import type { NormalizedWhatsAppInboundEvent } from "./normalize";
import type { WhatsAppInboundAgentDecision } from "@/lib/ai/whatsapp-inbound-agent";

export type WhatsAppEscalationWork = {
  reason: string;
  priority: "low" | "normal" | "high" | "urgent";
  summary: string;
  customerFollowUpText: string;
  humanAlertText: string;
};

function priorityFor(reason: string, event: NormalizedWhatsAppInboundEvent) {
  const text = `${reason} ${event.body || ""}`.toLowerCase();
  if (/emergencia|urgente|m[eé]dic|hospital|accidente|pasaporte perdido/.test(text)) return "urgent";
  if (/pago|cancel|reembolso|reserv|confirmar/.test(text)) return "high";
  return "normal";
}

function defaultCustomerFollowUp() {
  return [
    "Gracias por escribirnos y por contarnos lo que necesitas.",
    "Entendemos que es importante recibir orientación clara antes de avanzar, así que un asesor de TravelHub revisará tu mensaje y te dará seguimiento personalmente para ayudarte con cuidado.",
  ].join(" ");
}

export function buildWhatsAppEscalationWork(
  event: NormalizedWhatsAppInboundEvent,
  decision: WhatsAppInboundAgentDecision
): WhatsAppEscalationWork {
  const reason = decision.escalationReason || "El agente inbound solicitó revisión humana.";
  const summary = decision.summary || event.body || `Mensaje ${event.messageType} recibido por WhatsApp`;
  const priority = priorityFor(reason, event);
  const sender = event.profileName ? `${event.profileName} (${event.fromPhone})` : event.fromPhone;

  return {
    reason,
    priority,
    summary,
    customerFollowUpText: decision.responseText || defaultCustomerFollowUp(),
    humanAlertText: [
      "TravelHub WhatsApp requiere atención humana.",
      `Cliente: ${sender}`,
      `Prioridad: ${priority}`,
      `Motivo: ${reason}`,
      `Resumen: ${summary}`,
    ].join("\n"),
  };
}

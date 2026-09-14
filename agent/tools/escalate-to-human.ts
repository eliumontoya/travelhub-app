import { defineTool } from "eve/tools";
import { z } from "zod";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";

function sanitizeError(error: unknown): string {
  if (!error) return "Escalation failed.";
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/service[_ -]?role|bearer|token|key|secret/gi, "credential").slice(0, 160);
}

export default defineTool({
  description:
    "Escala la conversación a un agente humano de TravelHub. Persiste la escalación en la base de datos para que aparezca en el command center. Usar cuando el cliente solicite cotizaciones, pagos, cancelaciones, emergencias, o cuando no puedas resolver su solicitud con seguridad. Después de escalar, informa al cliente que un asesor le dará seguimiento.",
  inputSchema: z.object({
    reason: z.string().min(1).max(500).describe("Motivo breve de la escalación"),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal").describe("Prioridad de la escalación"),
    summary: z.string().min(1).max(1000).describe("Resumen breve del contexto de la escalación"),
    phone: z.string().min(5).max(32).optional().describe("Número de WhatsApp del cliente en formato E.164. Si no se proporciona, se usará el contacto más reciente."),
  }),
  async execute({ reason, priority, summary, phone }: { reason: string; priority: string; summary: string; phone?: string }) {
    try {
      const supabase = getSupabaseAdmin();

      let contactId: string;

      if (phone) {
        const contactResult = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("phone_e164", phone)
          .maybeSingle();

        if (contactResult.error) throw new Error(contactResult.error.message);
        const contactRow = contactResult.data as Record<string, unknown> | null;

        if (!contactRow || typeof contactRow.id !== "string") {
          return {
            success: false,
            escalated: false,
            error: "No se encontró el contacto en la base de datos.",
          };
        }

        contactId = contactRow.id;
      } else {
        const contactResult = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .order("last_message_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (contactResult.error) throw new Error(contactResult.error.message);
        const contactRow = contactResult.data as Record<string, unknown> | null;

        if (!contactRow || typeof contactRow.id !== "string") {
          return {
            success: false,
            escalated: false,
            error: "No se encontró ningún contacto en la base de datos.",
          };
        }

        contactId = contactRow.id;
      }

      const conversationResult = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("contact_id", contactId)
        .eq("status", "open")
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (conversationResult.error) throw new Error(conversationResult.error.message);
      const conversationRow = conversationResult.data as Record<string, unknown> | null;

      if (!conversationRow || typeof conversationRow.id !== "string") {
        return {
          success: false,
          escalated: false,
          error: "No se encontró una conversación abierta para este contacto.",
        };
      }

      const conversationId = conversationRow.id;

      const messageResult = await supabase
        .from("whatsapp_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("direction", "inbound")
        .order("occurred_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (messageResult.error) throw new Error(messageResult.error.message);
      const messageRow = messageResult.data as Record<string, unknown> | null;

      const messageId = messageRow && typeof messageRow.id === "string" ? messageRow.id : null;

      const escalationResult = await supabase
        .from("whatsapp_escalations")
        .insert({
          conversation_id: conversationId,
          contact_id: contactId,
          ...(messageId ? { message_id: messageId } : {}),
          reason,
          priority,
          summary,
          status: "open",
        })
        .select("id")
        .single();

      if (escalationResult.error) throw new Error(escalationResult.error.message);
      const escalationRow = escalationResult.data as Record<string, unknown> | null;

      if (!escalationRow || typeof escalationRow.id !== "string") {
        return {
          success: false,
          escalated: false,
          error: "No se pudo crear la escalación.",
        };
      }

      await supabase
        .from("whatsapp_conversations")
        .update({ status: "escalated" })
        .eq("id", conversationId);

      return {
        success: true,
        escalated: true,
        escalationId: escalationRow.id,
        conversationId,
        contactId,
        messageId,
        reason,
        priority,
        summary,
        message: "La conversación ha sido escalada a un asesor de TravelHub y aparece en el command center.",
      };
    } catch (error) {
      return {
        success: false,
        escalated: false,
        error: sanitizeError(error),
      };
    }
  },
});

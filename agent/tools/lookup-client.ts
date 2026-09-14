import { defineTool } from "eve/tools";
import { z } from "zod";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function sanitizeError(error: unknown): string {
  if (!error) return "Client lookup failed.";
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/service[_ -]?role|bearer|token|key|secret/gi, "credential").slice(0, 160);
}

export default defineTool({
  description:
    "Identifica al cliente de TravelHub por su número de WhatsApp. Devuelve el clientId si lo encuentra, 'ambiguous' si hay múltiples coincidencias, o 'not_found' si no existe. Siempre usar antes de consultar viajes.",
  inputSchema: z.object({
    phone: z.string().min(5).max(32).describe("Número de WhatsApp del cliente en cualquier formato"),
  }),
  async execute({ phone }: { phone: string }) {
    const normalized = normalizePhone(phone);

    try {
      const supabase = getSupabaseAdmin();

      const whatsappResult = await supabase
        .from("clients")
        .select("id, name, whatsapp")
        .eq("whatsapp_normalized", normalized)
        .limit(2);

      if (whatsappResult.error) throw new Error(whatsappResult.error.message);

      const whatsappMatches = (whatsappResult.data ?? []) as Record<string, unknown>[];

      if (whatsappMatches.length === 1 && typeof whatsappMatches[0].id === "string") {
        return {
          success: true,
          found: true,
          clientId: whatsappMatches[0].id,
          displayName: typeof whatsappMatches[0].name === "string" ? whatsappMatches[0].name : undefined,
          matchConfidence: "exact",
        };
      }

      if (whatsappMatches.length > 1) {
        return {
          success: true,
          found: false,
          matchConfidence: "possible",
          reason: "Multiple TravelHub clients match this WhatsApp phone.",
        };
      }

      const contactResult = await supabase
        .from("whatsapp_contacts")
        .select("linked_client_id, display_name, phone_e164, clients(id, name)")
        .eq("phone_e164", normalized)
        .maybeSingle();

      if (contactResult.error) throw new Error(contactResult.error.message);

      const contactRow = contactResult.data as Record<string, unknown> | null;
      if (contactRow && typeof contactRow.linked_client_id === "string") {
        const nested = contactRow.clients as Record<string, unknown> | undefined;
        const displayName = nested && typeof nested.name === "string"
          ? nested.name
          : typeof contactRow.display_name === "string"
            ? contactRow.display_name
            : undefined;

        return {
          success: true,
          found: true,
          clientId: contactRow.linked_client_id,
          displayName,
          matchConfidence: "exact",
        };
      }

      const fallbackResult = await supabase
        .from("clients")
        .select("id, name, phone")
        .in("phone", Array.from(new Set([phone, normalized])))
        .limit(2);

      if (fallbackResult.error) throw new Error(fallbackResult.error.message);

      const fallbackMatches = (fallbackResult.data ?? []) as Record<string, unknown>[];

      if (fallbackMatches.length === 1 && typeof fallbackMatches[0].id === "string") {
        return {
          success: true,
          found: true,
          clientId: fallbackMatches[0].id,
          displayName: typeof fallbackMatches[0].name === "string" ? fallbackMatches[0].name : undefined,
          matchConfidence: "exact",
        };
      }

      if (fallbackMatches.length > 1) {
        return {
          success: true,
          found: false,
          matchConfidence: "possible",
          reason: "Multiple possible clients match this phone.",
        };
      }

      return {
        success: true,
        found: false,
        matchConfidence: "none",
        reason: "No TravelHub client is linked to this WhatsApp phone.",
      };
    } catch (error) {
      return {
        success: false,
        found: false,
        error: sanitizeError(error),
      };
    }
  },
});

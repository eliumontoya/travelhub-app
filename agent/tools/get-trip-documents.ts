import { defineTool } from "eve/tools";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";

function sanitizeError(error: unknown): string {
  if (!error) return "Document status failed.";
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/service[_ -]?role|bearer|token|key|secret/gi, "credential").slice(0, 160);
}

async function verifyTripOwnership(supabase: ReturnType<typeof getSupabaseAdmin>, clientId: string, tripId: string) {
  const bridge = await supabase
    .from("trip_clients")
    .select("trip_id")
    .eq("client_id", clientId)
    .eq("trip_id", tripId)
    .maybeSingle();
  if (bridge.error) throw new Error(bridge.error.message);
  if (bridge.data) return true;

  const legacy = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (legacy.error) throw new Error(legacy.error.message);
  return Boolean(legacy.data);
}

export default defineTool({
  description:
    "Verifica si un viaje tiene documentos disponibles (boarding passes, vouchers, etc.). No envía los documentos, solo informa si existen y cuántos hay.",
  inputSchema: z.object({
    clientId: z.string().min(1).max(100).describe("ID del cliente"),
    tripId: z.string().min(1).max(100).describe("ID del viaje"),
  }),
  async execute({ clientId, tripId }: { clientId: string; tripId: string }) {
    try {
      const supabase = getSupabaseAdmin();

      const owned = await verifyTripOwnership(supabase, clientId, tripId);
      if (!owned) {
        return {
          success: false,
          status: "blocked",
          reason: "Requested trip does not belong to the resolved WhatsApp client.",
        };
      }

      const tripStatus = await supabase
        .from("trips")
        .select("id, status")
        .eq("id", tripId)
        .maybeSingle();

      if (tripStatus.error) throw new Error(tripStatus.error.message);
      const tripRow = tripStatus.data as Record<string, unknown> | null;

      if (!tripRow || typeof tripRow.id !== "string") {
        return { success: false, status: "not_found", reason: "Trip not found." };
      }

      if (tripRow.status !== "published") {
        return {
          success: true,
          status: "success",
          tripDocumentCount: 0,
          itemDocumentCount: 0,
          hasDocuments: false,
          reason: "Trip is not published yet.",
        };
      }

      const tripDocs = await supabase
        .from("trip_documents")
        .select("id")
        .eq("trip_id", tripId);
      if (tripDocs.error) throw new Error(tripDocs.error.message);

      const dayDocs = await supabase
        .from("trip_days")
        .select("items(id, documents(id))")
        .eq("trip_id", tripId);
      if (dayDocs.error) throw new Error(dayDocs.error.message);

      const tripDocumentCount = Array.isArray(tripDocs.data) ? tripDocs.data.length : 0;
      let itemDocumentCount = 0;
      for (const day of Array.isArray(dayDocs.data) ? dayDocs.data as Record<string, unknown>[] : []) {
        for (const item of Array.isArray(day.items) ? day.items as Record<string, unknown>[] : []) {
          itemDocumentCount += Array.isArray(item.documents) ? item.documents.length : 0;
        }
      }

      return {
        success: true,
        status: "success",
        tripDocumentCount,
        itemDocumentCount,
        hasDocuments: tripDocumentCount + itemDocumentCount > 0,
        linksIncluded: false,
      };
    } catch (error) {
      return { success: false, status: "error", error: sanitizeError(error) };
    }
  },
});

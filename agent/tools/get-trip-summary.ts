import { defineTool } from "eve/tools";
import { z } from "zod";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";

function sanitizeError(error: unknown): string {
  if (!error) return "Trip summary failed.";
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
    "Obtiene información general de un viaje específico: título, fechas, estado, número de viajeros, moneda. Solo para viajes publicados; si el viaje está en draft, indica que está en planeación.",
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

      const trip = await supabase
        .from("trips")
        .select("id, title, slug, start_date, end_date, status, traveler_count, currency, show_costs_to_client")
        .eq("id", tripId)
        .maybeSingle();

      if (trip.error) throw new Error(trip.error.message);
      const row = trip.data as Record<string, unknown> | null;

      if (!row || typeof row.id !== "string") {
        return { success: false, status: "not_found", reason: "Trip not found." };
      }

      const status = typeof row.status === "string" ? row.status : "draft";
      if (status !== "published") {
        return {
          success: true,
          status: "success",
          tripId: row.id,
          title: "Viaje en planeación",
          slug: null,
          startDate: null,
          endDate: null,
          tripStatus: status,
          travelerCount: null,
          currency: null,
          publicItineraryAvailable: false,
          reason: "Trip is not published yet.",
        };
      }

      return {
        success: true,
        status: "success",
        tripId: row.id,
        title: typeof row.title === "string" ? row.title : "Viaje",
        slug: typeof row.slug === "string" ? row.slug : null,
        startDate: typeof row.start_date === "string" ? row.start_date : null,
        endDate: typeof row.end_date === "string" ? row.end_date : null,
        tripStatus: status,
        travelerCount: typeof row.traveler_count === "number" ? row.traveler_count : null,
        currency: typeof row.currency === "string" ? row.currency : null,
        publicItineraryAvailable: status === "published" && typeof row.slug === "string",
      };
    } catch (error) {
      return { success: false, status: "error", error: sanitizeError(error) };
    }
  },
});

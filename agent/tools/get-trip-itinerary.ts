import { defineTool } from "eve/tools";
import { z } from "zod";

import { getSupabaseAdmin } from "../lib/supabase-admin.js";

function sanitizeError(error: unknown): string {
  if (!error) return "Itinerary status failed.";
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
    "Obtiene el itinerario día por día de un viaje publicado: actividades, horarios, ubicaciones y si hay códigos de confirmación disponibles. Devuelve los primeros 5 items próximos.",
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
          dayCount: 0,
          itemCounts: {},
          nextItems: [],
          reason: "Trip is not published yet.",
        };
      }

      const daysResult = await supabase
        .from("trip_days")
        .select("id, date, items(id, type, title, start_time, end_time, location, confirmation_code)")
        .eq("trip_id", tripId)
        .order("sort_order", { ascending: true });

      if (daysResult.error) throw new Error(daysResult.error.message);

      const days = Array.isArray(daysResult.data) ? daysResult.data as Record<string, unknown>[] : [];
      const itemCounts: Record<string, number> = {};
      const nextItems: Array<Record<string, string | null>> = [];

      for (const day of days) {
        const items = Array.isArray(day.items) ? day.items as Record<string, unknown>[] : [];
        for (const item of items) {
          const type = typeof item.type === "string" ? item.type : "unknown";
          itemCounts[type] = (itemCounts[type] ?? 0) + 1;
          if (nextItems.length < 5) {
            nextItems.push({
              title: typeof item.title === "string" ? item.title : "Actividad",
              type,
              date: typeof day.date === "string" ? day.date : null,
              startTime: typeof item.start_time === "string" ? item.start_time : null,
              location: typeof item.location === "string" ? item.location : null,
              confirmationAvailable: item.confirmation_code ? "yes" : "no",
            });
          }
        }
      }

      return {
        success: true,
        status: "success",
        dayCount: days.length,
        itemCounts,
        nextItems,
      };
    } catch (error) {
      return { success: false, status: "error", error: sanitizeError(error) };
    }
  },
});

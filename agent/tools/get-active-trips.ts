import { defineTool } from "eve/tools";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";

type TravelHubTripChoice = {
  tripId: string;
  title: string;
  slug: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string;
};

function normalizeTrip(row: Record<string, unknown>): TravelHubTripChoice | null {
  const source = row.trips && typeof row.trips === "object" && !Array.isArray(row.trips)
    ? row.trips as Record<string, unknown>
    : row;
  if (typeof source.id !== "string" || typeof source.title !== "string") return null;
  const status = typeof source.status === "string" ? source.status : "draft";
  if (status !== "published") {
    return {
      tripId: source.id,
      title: "Viaje en planeación",
      slug: null,
      startDate: null,
      endDate: null,
      status,
    };
  }
  return {
    tripId: source.id,
    title: source.title,
    slug: typeof source.slug === "string" ? source.slug : null,
    startDate: typeof source.start_date === "string" ? source.start_date : null,
    endDate: typeof source.end_date === "string" ? source.end_date : null,
    status,
  };
}

function sanitizeError(error: unknown): string {
  if (!error) return "Trip lookup failed.";
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/service[_ -]?role|bearer|token|key|secret/gi, "credential").slice(0, 160);
}

export default defineTool({
  description:
    "Obtiene los viajes activos o recientes de un cliente identificado. Devuelve 'ambiguous' si hay múltiples viajes (pedir al cliente que elija), 'not_found' si no tiene viajes, o 'success' con un solo viaje.",
  inputSchema: z.object({
    clientId: z.string().min(1).max(100).describe("ID del cliente obtenido de lookup-client"),
  }),
  async execute({ clientId }: { clientId: string }) {
    try {
      const supabase = getSupabaseAdmin();

      const throughBridge = await supabase
        .from("trip_clients")
        .select("trip_id, trips(id, title, slug, start_date, end_date, status)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (throughBridge.error) throw new Error(throughBridge.error.message);

      const legacy = await supabase
        .from("trips")
        .select("id, title, slug, start_date, end_date, status")
        .eq("client_id", clientId)
        .neq("status", "archived")
        .order("start_date", { ascending: false, nullsFirst: false })
        .limit(5);

      if (legacy.error) throw new Error(legacy.error.message);

      const tripsById = new Map<string, TravelHubTripChoice>();
      for (const row of [
        ...(Array.isArray(throughBridge.data) ? throughBridge.data : []),
        ...(Array.isArray(legacy.data) ? legacy.data : []),
      ] as Record<string, unknown>[]) {
        const trip = normalizeTrip(row);
        if (trip && trip.status !== "archived") tripsById.set(trip.tripId, trip);
      }

      const trips = [...tripsById.values()];
      const status = trips.length === 0 ? "not_found" : trips.length > 1 ? "ambiguous" : "success";
      const reason = trips.length === 0
        ? "No active or recent trips were found for this client."
        : trips.length > 1
          ? "Multiple active or recent trips require clarification."
          : undefined;

      return { success: true, status, trips, reason };
    } catch (error) {
      return { success: false, status: "error", trips: [], error: sanitizeError(error) };
    }
  },
});

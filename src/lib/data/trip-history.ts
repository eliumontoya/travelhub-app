import { Trip, TripStatusHistoryEntry } from "@/types";
import { ALL_TRIPS_PAGE_SIZE, createServerSupabase, sanitizeNote } from "@/lib/data/shared";
import { getTrips } from "@/lib/data/trips";

// ---------- Historial de estados, notas internas y métricas ----------

// Notas privadas de agente (Tritones), NUNCA visibles en /t/[slug]. Se leen y
// escriben a propósito por fuera de getTripById/getTripWithDetails/rowToTrip:
// esa ruta compartida alimenta tanto el dashboard como la vista pública, así
// que internal_notes jamás se selecciona/mapea ahí. Se hace un SELECT de una
// sola columna (nunca select("*") junto al resto del trip).
export async function getTripInternalNotes(id: string): Promise<string | null> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("internal_notes")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data?.internal_notes as string | null) ?? null;
}

export async function updateTripInternalNotes(id: string, internalNotes: string | null): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trips")
    .update({ internal_notes: sanitizeNote(internalNotes) })
    .eq("id", id);
  if (error) throw error;
}

export async function getTripStatusHistory(tripId: string): Promise<TripStatusHistoryEntry[]> {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_status_history")
    .select("*")
    .eq("trip_id", tripId)
    .order("changed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(rowToTripStatusHistory);
}

function rowToTripStatusHistory(row: Record<string, unknown>): TripStatusHistoryEntry {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    fromStatus: (row.from_status as Trip["status"] | null) ?? null,
    toStatus: row.to_status as Trip["status"],
    changedAt: row.changed_at as string,
  };
}

export type MonthlyTripCount = { label: string; count: number };

// Agrupa trips por mes de creación para los últimos 6 meses (incluyendo el
// mes actual), rellenando con 0 los meses sin viajes creados. El agrupado se
// hace en JS (no SQL) reutilizando getTrips() en vez de una query nueva.
export async function getTripsPerMonth(): Promise<MonthlyTripCount[]> {
  const { items: trips } = await getTrips({ pageSize: ALL_TRIPS_PAGE_SIZE });

  const now = new Date();
  const months: { year: number; month: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }

  const counts = months.map(() => 0);
  for (const trip of trips) {
    const created = new Date(trip.createdAt);
    const idx = months.findIndex(
      (m) => m.year === created.getFullYear() && m.month === created.getMonth()
    );
    if (idx !== -1) counts[idx]++;
  }

  return months.map((m, idx) => ({
    label: new Date(m.year, m.month, 1).toLocaleDateString("es-MX", {
      month: "short",
      year: "numeric",
    }),
    count: counts[idx],
  }));
}

import { Client, Trip } from "@/types";
import { createServerSupabase } from "@/lib/data/shared";
import { rowToClient } from "@/lib/data/clients";
import { rowToTrip } from "@/lib/data/trips";

// ---------- Recordatorios automáticos por email (issue #49) ----------

export type TripReminderCandidate = Trip & { client: Client };

// Viajes publicados que empiezan entre hoy y hoy+daysAhead, sin recordatorio
// enviado todavía. Devuelve el cliente principal (primer asignado por
// created_at asc, igual que assembleTripWithDetails) porque el email se
// manda a un único destinatario.
export async function getTripsPendingReminder(daysAhead: number): Promise<TripReminderCandidate[]> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setUTCDate(cutoff.getUTCDate() + daysAhead);
  const todayStr = today.toISOString().slice(0, 10);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const supabase = await createServerSupabase();
  const { data: tripRows, error } = await supabase
    .from("trips")
    .select("*")
    .eq("status", "published")
    .is("reminder_sent_at", null)
    .gte("start_date", todayStr)
    .lte("start_date", cutoffStr);
  if (error) throw error;

  const trips = (tripRows ?? []).map(rowToTrip);
  if (!trips.length) return [];

  const tripIds = trips.map((t) => t.id);
  const { data: linkRows, error: linksError } = await supabase
    .from("trip_clients")
    .select("trip_id, client_id, created_at")
    .in("trip_id", tripIds)
    .order("created_at", { ascending: true });
  if (linksError) throw linksError;

  const primaryClientIdByTrip = new Map<string, string>();
  (linkRows ?? []).forEach((l) => {
    const tripId = l.trip_id as string;
    if (!primaryClientIdByTrip.has(tripId)) primaryClientIdByTrip.set(tripId, l.client_id as string);
  });

  const clientIds = [...new Set(primaryClientIdByTrip.values())];
  let clientsById = new Map<string, Client>();
  if (clientIds.length) {
    const { data: clientRows, error: clientsError } = await supabase
      .from("clients")
      .select("*")
      .in("id", clientIds);
    if (clientsError) throw clientsError;
    clientsById = new Map((clientRows ?? []).map((c) => [c.id as string, rowToClient(c)]));
  }

  return trips
    .map((trip) => {
      const clientId = primaryClientIdByTrip.get(trip.id);
      const client = clientId ? clientsById.get(clientId) : undefined;
      return client ? { ...trip, client } : null;
    })
    .filter((t): t is TripReminderCandidate => Boolean(t));
}

export async function markTripReminderSent(tripId: string): Promise<void> {
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trips")
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq("id", tripId);
  if (error) throw error;
}

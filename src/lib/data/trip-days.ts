import { TripDay } from "@/types";
import { mockTripDays } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured, sanitizeNote, uid } from "@/lib/data/shared";
import { getTripById } from "@/lib/data/trips";

// ---------- Trip days ----------

export type CreateTripDayInput = { tripId: string; date: string; notes?: string; sortOrder?: number };
export type UpdateTripDayInput = Partial<{ date: string; notes: string; sortOrder: number }>;

export async function createTripDay(input: CreateTripDayInput): Promise<TripDay> {
  if (!isSupabaseConfigured()) {
    const day: TripDay = {
      id: uid(),
      tripId: input.tripId,
      date: input.date,
      notes: sanitizeNote(input.notes),
      sortOrder:
        input.sortOrder ??
        mockTripDays.filter((d) => d.tripId === input.tripId).length,
    };
    mockTripDays.push(day);
    return day;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_days")
    .insert({
      trip_id: input.tripId,
      date: input.date,
      notes: sanitizeNote(input.notes),
      sort_order: input.sortOrder ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTripDay(data);
}

export async function updateTripDay(id: string, input: UpdateTripDayInput): Promise<TripDay> {
  if (!isSupabaseConfigured()) {
    const day = mockTripDays.find((d) => d.id === id);
    if (!day) throw new Error("Día no encontrado");
    if (input.date !== undefined) day.date = input.date;
    if (input.notes !== undefined) day.notes = sanitizeNote(input.notes);
    if (input.sortOrder !== undefined) day.sortOrder = input.sortOrder;
    return day;
  }
  const supabase = await createServerSupabase();
  const patch: Record<string, unknown> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.notes !== undefined) patch.notes = sanitizeNote(input.notes);
  if (input.sortOrder !== undefined) patch.sort_order = input.sortOrder;
  const { data, error } = await supabase
    .from("trip_days")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTripDay(data);
}

// Soft delete (issue #23): marca deleted_at en vez de borrar la fila, para
// poder deshacer dentro de la misma sesión (toast "Deshacer"). Los items de
// ese día NO se marcan individualmente: quedan ocultos porque las consultas
// de lectura (assembleTripWithDetails / mock getTripWithDetails) ya excluyen
// items cuyo trip_day padre está soft-deleted.
export async function deleteTripDay(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const day = mockTripDays.find((d) => d.id === id);
    if (day) day.deletedAt = new Date().toISOString();
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase
    .from("trip_days")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function restoreTripDay(id: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    const day = mockTripDays.find((d) => d.id === id);
    if (day) day.deletedAt = undefined;
    return;
  }
  const supabase = await createServerSupabase();
  const { error } = await supabase.from("trip_days").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
}

export function rowToTripDay(row: Record<string, unknown>): TripDay {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    date: row.date as string,
    notes: (row.notes as string) ?? undefined,
    sortOrder: row.sort_order as number,
  };
}

export type GenerateTripDaysResult = { created: number; totalDays: number };

// Recorre start_date..end_date del viaje día por día, crea los trip_days que
// falten (createTripDay ya resuelve mock/Supabase) y luego reescribe el
// sort_order de TODOS los días del viaje en orden cronológico, para que los
// días recién generados queden intercalados correctamente y no simplemente
// al final de la lista.
export async function generateTripDays(tripId: string): Promise<GenerateTripDaysResult> {
  const trip = await getTripById(tripId);
  if (!trip) throw new Error("Viaje no encontrado");
  if (!trip.startDate || !trip.endDate) {
    throw new Error("El viaje necesita fecha de inicio y fin para generar los días");
  }

  const dates = enumerateDates(trip.startDate, trip.endDate);
  if (dates.length === 0) {
    throw new Error("El rango de fechas del viaje no es válido");
  }

  const dayIdByDate = new Map(trip.days.map((d) => [d.date, d.id]));
  const missingDates = dates.filter((date) => !dayIdByDate.has(date));

  for (const date of missingDates) {
    const created = await createTripDay({ tripId, date });
    dayIdByDate.set(date, created.id);
  }

  const order = dates.map((date, index) => ({
    id: dayIdByDate.get(date) as string,
    sortOrder: index,
  }));
  await reorderTripDays(order);

  return { created: missingDates.length, totalDays: dates.length };
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates: string[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export async function reorderTripDays(order: { id: string; sortOrder: number }[]): Promise<void> {
  if (!isSupabaseConfigured()) {
    for (const { id, sortOrder } of order) {
      const day = mockTripDays.find((d) => d.id === id);
      if (day) day.sortOrder = sortOrder;
    }
    return;
  }
  const supabase = await createServerSupabase();
  await Promise.all(
    order.map(({ id, sortOrder }) =>
      supabase.from("trip_days").update({ sort_order: sortOrder }).eq("id", id)
    )
  );
}

import { TripFeedback } from "@/types";
import { mockTripFeedback } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured, uid } from "@/lib/data/shared";

// ---------- Trip feedback (issue #46) ----------

export type CreateTripFeedbackInput = { tripId: string; rating: number; comment?: string };

// Insert público desde /t/{slug} (sin auth); RLS en trip_feedback (ver
// 0018_trip_feedback.sql) solo permite el insert si el trip referenciado
// está publicado, por lo que no se re-valida ese status aquí.
export async function createTripFeedback(input: CreateTripFeedbackInput): Promise<TripFeedback> {
  if (!isSupabaseConfigured()) {
    const feedback: TripFeedback = {
      id: uid(),
      tripId: input.tripId,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    };
    mockTripFeedback.push(feedback);
    return feedback;
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_feedback")
    .insert({ trip_id: input.tripId, rating: input.rating, comment: input.comment })
    .select()
    .single();
  if (error) throw error;
  return rowToTripFeedback(data);
}

export async function getTripFeedback(tripId: string): Promise<TripFeedback[]> {
  if (!isSupabaseConfigured()) {
    return mockTripFeedback
      .filter((f) => f.tripId === tripId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trip_feedback")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToTripFeedback);
}

export function rowToTripFeedback(row: Record<string, unknown>): TripFeedback {
  return {
    id: row.id as string,
    tripId: row.trip_id as string,
    rating: row.rating as number,
    comment: (row.comment as string) ?? undefined,
    createdAt: row.created_at as string,
  };
}

"use server";

import { revalidatePath } from "next/cache";
import { updateTrip } from "@/lib/data";
import { TripStatus } from "@/types";

// Usado por la vista de tablero (kanban) del dashboard para mover un viaje
// entre columnas de estado. Reutiliza updateTrip (única vía de escritura de
// estado en src/lib/data.ts); no hay lógica de negocio nueva aquí.
export async function moveTripStatusAction(tripId: string, status: TripStatus) {
  await updateTrip(tripId, { status });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trips");
}

export async function bulkUpdateTripStatusAction(
  tripIds: string[],
  status: "published" | "archived"
) {
  for (const id of tripIds) {
    await updateTrip(id, { status });
  }
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/trips");
}

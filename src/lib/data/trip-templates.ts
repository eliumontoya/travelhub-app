import { Trip } from "@/types";
import { mockTrips } from "@/lib/mock-data";
import { createServerSupabase, isSupabaseConfigured } from "@/lib/data/shared";
import { createTripDay } from "@/lib/data/trip-days";
import { createItem } from "@/lib/data/trip-items";
import { CreateTripInput, createTrip, getTripById, rowToTrip } from "@/lib/data/trips";

// ---------- Templates (issue #31) ----------

// Viajes marcados como plantilla (issue #31): estructura de días/items
// reusable, sin cliente asociado. Se listan aparte de getTrips() (que las
// excluye) para el selector de "crear desde plantilla".
export async function getTemplates(): Promise<Trip[]> {
  if (!isSupabaseConfigured()) {
    return mockTrips
      .filter((t) => t.isTemplate)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("is_template", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(rowToTrip);
}

// Copia días + items (sin documentos, issue #31) de un viaje/plantilla origen
// hacia un viaje destino recién creado. Reusa createTripDay/createItem (que
// ya manejan mock/Supabase) en vez de duplicar esa lógica aquí.
async function copyTripDaysAndItems(sourceTripId: string, destTripId: string): Promise<void> {
  const source = await getTripById(sourceTripId);
  if (!source) throw new Error("Viaje origen no encontrado");
  for (const day of source.days) {
    const newDay = await createTripDay({
      tripId: destTripId,
      date: day.date,
      notes: day.notes,
      sortOrder: day.sortOrder,
    });
    for (const item of day.items) {
      await createItem({
        tripDayId: newDay.id,
        type: item.type,
        title: item.title,
        startTime: item.startTime,
        endTime: item.endTime,
        location: item.location,
        lat: item.lat,
        lng: item.lng,
        confirmationCode: item.confirmationCode,
        notes: item.notes,
        sortOrder: item.sortOrder,
      });
    }
  }
}

function templateSlug(title: string): string {
  const base =
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "plantilla";
  return `plantilla-${base}-${Date.now().toString(36)}`;
}

// Guarda la estructura de días/items de un viaje existente como una nueva
// plantilla (is_template = true, sin cliente). No copia documentos.
export async function saveTripAsTemplate(tripId: string, title: string): Promise<Trip> {
  const template = await createTrip({ title, slug: templateSlug(title), isTemplate: true });
  await copyTripDaysAndItems(tripId, template.id);
  return template;
}

// Crea un viaje normal (requiere clientIds como createTrip) y le copia la
// estructura de días/items de una plantilla existente.
export async function createTripFromTemplate(
  templateId: string,
  input: CreateTripInput
): Promise<Trip> {
  const trip = await createTrip(input);
  await copyTripDaysAndItems(templateId, trip.id);
  return trip;
}

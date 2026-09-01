import { Trip } from "@/types";
import { ALL_CLIENTS_PAGE_SIZE, ALL_TRIPS_PAGE_SIZE } from "@/lib/data/shared";
import { getClients } from "@/lib/data/clients";
import { getTrips } from "@/lib/data/trips";

// ---------- Actividad reciente (dashboard) ----------

export type ActivityFeedItem = {
  id: string;
  entityType: "trip" | "client";
  action: "created" | "updated";
  title: string;
  href: string;
  timestamp: string;
};

// Feed combinado de los N eventos más recientes entre trips y clients,
// ordenado por updated_at desc. No hay un log de eventos separado: se
// clasifica cada fila como "updated" si updated_at se movió después de
// created_at (con margen de 1s para tolerar el redondeo del insert inicial),
// o "created" si no.
export async function getRecentActivity(limit = 8): Promise<ActivityFeedItem[]> {
  const [{ items: trips }, { items: clients }] = await Promise.all([
    getTrips({ pageSize: ALL_TRIPS_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
  ]);

  const wasEdited = (createdAt: string, updatedAt: string) =>
    Date.parse(updatedAt) - Date.parse(createdAt) > 1000;

  const tripItems: ActivityFeedItem[] = trips.map((trip) => ({
    id: trip.id,
    entityType: "trip",
    action: wasEdited(trip.createdAt, trip.updatedAt) ? "updated" : "created",
    title: trip.title,
    href: `/dashboard/trips/${trip.id}`,
    timestamp: trip.updatedAt,
  }));

  const clientItems: ActivityFeedItem[] = clients.map((client) => ({
    id: client.id,
    entityType: "client",
    action: wasEdited(client.createdAt, client.updatedAt) ? "updated" : "created",
    title: client.name,
    href: `/dashboard/clients/${client.id}`,
    timestamp: client.updatedAt,
  }));

  return [...tripItems, ...clientItems]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

// ---------- Dashboard stats ----------

export type TripStats = {
  byStatus: Record<Trip["status"], number>;
  upcomingNext7: number;
  upcomingNext30: number;
  newClientsThisMonth: number;
  unpublishedNearStart: number;
};

// Se apoya en getTrips()/getClients() (ya cubren el modo dual mock/Supabase),
// pidiendo el catálogo completo vía ALL_*_PAGE_SIZE, y calcula los conteos en
// JS: al ser una sola cuenta de agente, el volumen de trips/clients es bajo y
// no justifica duplicar el branching de isSupabaseConfigured() con queries
// agregadas.
export async function getTripStats(): Promise<TripStats> {
  const [{ items: trips }, { items: clients }] = await Promise.all([
    getTrips({ pageSize: ALL_TRIPS_PAGE_SIZE }),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
  ]);

  const now = new Date();
  const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const byStatus: Record<Trip["status"], number> = { draft: 0, published: 0, archived: 0 };
  let upcomingNext7 = 0;
  let upcomingNext30 = 0;
  let unpublishedNearStart = 0;

  for (const trip of trips) {
    byStatus[trip.status] = (byStatus[trip.status] ?? 0) + 1;

    const start = trip.startDate ? new Date(trip.startDate) : null;
    const hasValidStart = start !== null && !Number.isNaN(start.getTime());

    if (hasValidStart && start! >= now && start! <= in7Days) upcomingNext7++;
    if (hasValidStart && start! >= now && start! <= in30Days) upcomingNext30++;
    if (trip.status === "draft" && hasValidStart && start! >= now && start! <= in30Days) {
      unpublishedNearStart++;
    }
  }

  const newClientsThisMonth = clients.filter((client) => {
    const created = new Date(client.createdAt);
    return !Number.isNaN(created.getTime()) && created >= startOfMonth;
  }).length;

  return { byStatus, upcomingNext7, upcomingNext30, newClientsThisMonth, unpublishedNearStart };
}


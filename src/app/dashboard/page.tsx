import Link from "next/link";
import {
  getClientsWithTags,
  getTags,
  getTripStats,
  getTripsWithClients,
  getUpcomingUnpublishedTrips,
} from "@/lib/data";
import { formatDateShort } from "@/lib/item-meta";
import DashboardKpiCards from "@/components/DashboardKpiCards";
import { DashboardExplorer } from "./DashboardExplorer";

export default async function DashboardPage() {
  const [clients, trips, tags, stats, upcomingUnpublishedTrips] = await Promise.all([
    getClientsWithTags(),
    getTripsWithClients(),
    getTags(),
    getTripStats(),
    getUpcomingUnpublishedTrips(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {upcomingUnpublishedTrips.length > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold">
            {upcomingUnpublishedTrips.length === 1
              ? "1 viaje empieza en menos de 7 días y sigue en borrador"
              : `${upcomingUnpublishedTrips.length} viajes empiezan en menos de 7 días y siguen en borrador`}
          </p>
          <ul className="mt-2 space-y-1">
            {upcomingUnpublishedTrips.map((trip) => (
              <li key={trip.id}>
                <Link href={`/dashboard/trips/${trip.id}`} className="underline hover:no-underline">
                  {trip.title}
                </Link>{" "}
                · inicia {formatDateShort(trip.startDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis viajes</h1>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo viaje
        </Link>
      </div>

      <DashboardKpiCards stats={stats} />

      <DashboardExplorer trips={trips} clients={clients} tags={tags} />
    </main>
  );
}

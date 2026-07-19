import Link from "next/link";
import {
  DEFAULT_PAGE_SIZE,
  getClientsWithTags,
  getTags,
  getTripStats,
  getTripsWithClients,
  getUpcomingUnpublishedTrips,
} from "@/lib/data";
import { formatDateShort } from "@/lib/item-meta";
import DashboardKpiCards from "@/components/DashboardKpiCards";
import { DashboardExplorer } from "./DashboardExplorer";

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; clientsPage?: string }>;
}) {
  const { page, clientsPage } = await searchParams;
  const tripsPage = parsePage(page);
  const clientsPageNum = parsePage(clientsPage);

  const [
    { items: trips, totalCount: tripsTotal },
    { items: clients, totalCount: clientsTotal },
    tags,
    stats,
    upcomingUnpublishedTrips,
  ] = await Promise.all([
    getTripsWithClients({ page: tripsPage }),
    getClientsWithTags({ page: clientsPageNum }),
    getTags(),
    getTripStats(),
    getUpcomingUnpublishedTrips(),
  ]);

  const tripsTotalPages = Math.max(1, Math.ceil(tripsTotal / DEFAULT_PAGE_SIZE));
  const clientsTotalPages = Math.max(1, Math.ceil(clientsTotal / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      {upcomingUnpublishedTrips.length > 0 && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mis viajes</h1>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
        >
          + Nuevo viaje
        </Link>
      </div>

      <DashboardKpiCards stats={stats} />

      <DashboardExplorer
        trips={trips}
        clients={clients}
        tags={tags}
        tripsPagination={
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link
              href={`/dashboard?page=${tripsPage - 1}&clientsPage=${clientsPageNum}`}
              aria-disabled={tripsPage <= 1}
              className={
                tripsPage <= 1
                  ? "pointer-events-none text-gray-300 dark:text-gray-600"
                  : "text-blue-600 hover:underline dark:text-blue-400"
              }
            >
              ← Anteriores
            </Link>
            <span className="text-gray-400 dark:text-gray-500">
              Página {tripsPage} de {tripsTotalPages}
            </span>
            <Link
              href={`/dashboard?page=${tripsPage + 1}&clientsPage=${clientsPageNum}`}
              aria-disabled={tripsPage >= tripsTotalPages}
              className={
                tripsPage >= tripsTotalPages
                  ? "pointer-events-none text-gray-300 dark:text-gray-600"
                  : "text-blue-600 hover:underline dark:text-blue-400"
              }
            >
              Siguientes →
            </Link>
          </div>
        }
        clientsPagination={
          <div className="mt-4 flex items-center justify-between text-sm">
            <Link
              href={`/dashboard?page=${tripsPage}&clientsPage=${clientsPageNum - 1}`}
              aria-disabled={clientsPageNum <= 1}
              className={
                clientsPageNum <= 1
                  ? "pointer-events-none text-gray-300 dark:text-gray-600"
                  : "text-blue-600 hover:underline dark:text-blue-400"
              }
            >
              ← Anteriores
            </Link>
            <span className="text-gray-400 dark:text-gray-500">
              Página {clientsPageNum} de {clientsTotalPages}
            </span>
            <Link
              href={`/dashboard?page=${tripsPage}&clientsPage=${clientsPageNum + 1}`}
              aria-disabled={clientsPageNum >= clientsTotalPages}
              className={
                clientsPageNum >= clientsTotalPages
                  ? "pointer-events-none text-gray-300 dark:text-gray-600"
                  : "text-blue-600 hover:underline dark:text-blue-400"
              }
            >
              Siguientes →
            </Link>
          </div>
        }
      />
    </main>
  );
}

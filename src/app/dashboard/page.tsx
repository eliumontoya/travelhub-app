import Link from "next/link";
import {
  getClientReferralSourceCounts,
  getRecentActivity,
  getTripsPerMonth,
  getTripStats,
  getUpcomingBirthdays,
  getUpcomingUnpublishedTrips,
} from "@/lib/data";
import { formatDateShort, formatRelativeTime } from "@/lib/item-meta";
import DashboardKpiCards from "@/components/DashboardKpiCards";
import { TripsTrendChart } from "@/components/TripsTrendChart";
import { IntegrationsStatusCard } from "@/components/IntegrationsStatusCard";
import { ClientsByReferralSourceCard } from "@/components/ClientsByReferralSourceCard";

const activityMeta = {
  trip: { icon: "🧳", label: "viaje" },
  client: { icon: "👤", label: "cliente" },
};

const activityActionLabel = {
  created: "creado",
  updated: "editado",
};

export default async function DashboardPage() {
  const [
    stats,
    upcomingUnpublishedTrips,
    recentActivity,
    tripsPerMonth,
    upcomingBirthdays,
    referralSourceCounts,
  ] = await Promise.all([
    getTripStats(),
    getUpcomingUnpublishedTrips(),
    getRecentActivity(),
    getTripsPerMonth(),
    getUpcomingBirthdays(),
    getClientReferralSourceCounts(),
  ]);

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
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Resumen ejecutivo</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/trips/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            + Nuevo viaje
          </Link>
          <Link
            href="/dashboard/clients"
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Ver clientes
          </Link>
        </div>
      </div>

      <DashboardKpiCards stats={stats} />

      <div className="mt-10">
        <TripsTrendChart data={tripsPerMonth} />
      </div>

      <section className="mb-8 mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-800 dark:bg-amber-950">
        <h2 className="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-300">
          🎂 Cumpleaños próximos (30 días)
        </h2>
        {upcomingBirthdays.length > 0 ? (
          <ul className="space-y-2">
            {upcomingBirthdays.map((client) => (
              <li key={client.id} className="flex items-center justify-between text-sm">
                <Link
                  href={`/dashboard/clients/${client.id}`}
                  className="font-medium text-gray-900 hover:underline dark:text-gray-100"
                >
                  {client.name}
                </Link>
                <span className="text-amber-700 dark:text-amber-400">
                  {formatDateShort(client.birthDate)}
                  {" · "}
                  {client.daysUntilBirthday === 0
                    ? "hoy"
                    : client.daysUntilBirthday === 1
                      ? "mañana"
                      : `en ${client.daysUntilBirthday} días`}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No hay cumpleaños próximos registrados.
          </p>
        )}
      </section>

      <div className="mt-8">
        <IntegrationsStatusCard />
      </div>

      <ClientsByReferralSourceCard counts={referralSourceCounts} />

      <section className="mb-8 mt-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Actividad reciente
        </h2>
        {recentActivity.length > 0 ? (
          <ul className="grid gap-2">
            {recentActivity.map((event) => (
              <li key={`${event.entityType}-${event.id}`}>
                <Link
                  href={event.href}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 text-sm transition hover:shadow-md dark:border-gray-800 dark:bg-gray-900 sm:p-5"
                >
                  <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span aria-hidden>{activityMeta[event.entityType].icon}</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{event.title}</span>
                    <span className="text-gray-500 dark:text-gray-400">
                      {activityActionLabel[event.action]} · {activityMeta[event.entityType].label}
                    </span>
                  </span>
                  <span className="shrink-0 text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white p-5 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
            Todavía no hay actividad reciente.
          </div>
        )}
      </section>
    </main>
  );
}

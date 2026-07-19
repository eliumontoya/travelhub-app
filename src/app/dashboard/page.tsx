import Link from "next/link";
import { DEFAULT_PAGE_SIZE, getClients, getTripsWithClients } from "@/lib/data";
import { formatDateShort, formatAssignedClients, formatTags } from "@/lib/item-meta";

const statusMeta = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  published: { label: "Publicado", color: "bg-green-100 text-green-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400" },
};

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

  const [{ items: trips, totalCount: tripsTotal }, { items: clients, totalCount: clientsTotal }] =
    await Promise.all([
      getTripsWithClients({ page: tripsPage }),
      getClients({ page: clientsPageNum }),
    ]);

  const tripsTotalPages = Math.max(1, Math.ceil(tripsTotal / DEFAULT_PAGE_SIZE));
  const clientsTotalPages = Math.max(1, Math.ceil(clientsTotal / DEFAULT_PAGE_SIZE));

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis viajes</h1>
        <Link
          href="/dashboard/trips/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nuevo viaje
        </Link>
      </div>

      <div className="grid gap-4">
        {trips.map((trip) => {
          const status = statusMeta[trip.status];
          return (
            <Link
              key={trip.id}
              href={`/dashboard/trips/${trip.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-gray-900">{trip.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{formatAssignedClients(trip.clients)}</p>
                <p className="text-sm text-gray-400">
                  {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                </p>
                {trip.tags.length > 0 && (
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {formatTags(trip.tags).map((name) => (
                      <li
                        key={name}
                        className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                      >
                        {name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="text-gray-300">→</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          href={`/dashboard?page=${tripsPage - 1}&clientsPage=${clientsPageNum}`}
          aria-disabled={tripsPage <= 1}
          className={
            tripsPage <= 1 ? "pointer-events-none text-gray-300" : "text-blue-600 hover:underline"
          }
        >
          ← Anteriores
        </Link>
        <span className="text-gray-400">
          Página {tripsPage} de {tripsTotalPages}
        </span>
        <Link
          href={`/dashboard?page=${tripsPage + 1}&clientsPage=${clientsPageNum}`}
          aria-disabled={tripsPage >= tripsTotalPages}
          className={
            tripsPage >= tripsTotalPages
              ? "pointer-events-none text-gray-300"
              : "text-blue-600 hover:underline"
          }
        >
          Siguientes →
        </Link>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-gray-900">Clientes</h2>
      <div className="grid gap-3">
        {clients.map((client) => (
          <Link
            key={client.id}
            href={`/dashboard/clients/${client.id}`}
            className="rounded-lg border border-gray-200 bg-white p-4 transition hover:shadow-md"
          >
            <p className="font-medium text-gray-900">{client.name}</p>
            <p className="text-sm text-gray-500">{client.email} · {client.phone}</p>
          </Link>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link
          href={`/dashboard?page=${tripsPage}&clientsPage=${clientsPageNum - 1}`}
          aria-disabled={clientsPageNum <= 1}
          className={
            clientsPageNum <= 1
              ? "pointer-events-none text-gray-300"
              : "text-blue-600 hover:underline"
          }
        >
          ← Anteriores
        </Link>
        <span className="text-gray-400">
          Página {clientsPageNum} de {clientsTotalPages}
        </span>
        <Link
          href={`/dashboard?page=${tripsPage}&clientsPage=${clientsPageNum + 1}`}
          aria-disabled={clientsPageNum >= clientsTotalPages}
          className={
            clientsPageNum >= clientsTotalPages
              ? "pointer-events-none text-gray-300"
              : "text-blue-600 hover:underline"
          }
        >
          Siguientes →
        </Link>
      </div>
    </main>
  );
}

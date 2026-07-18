import Link from "next/link";
import { mockClients, mockTrips } from "@/lib/mock-data";
import { formatDateShort } from "@/lib/item-meta";

const statusMeta = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  published: { label: "Publicado", color: "bg-green-100 text-green-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400" },
};

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Mis viajes</h1>
        <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + Nuevo viaje
        </button>
      </div>

      <div className="grid gap-4">
        {mockTrips.map((trip) => {
          const client = mockClients.find((c) => c.id === trip.clientId);
          const status = statusMeta[trip.status];
          return (
            <Link
              key={trip.id}
              href={`/dashboard/trips/${trip.id}`}
              className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-gray-900">{trip.title}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-500">{client?.name}</p>
                <p className="text-sm text-gray-400">
                  {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                </p>
              </div>
              <span className="text-gray-300">→</span>
            </Link>
          );
        })}
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-gray-900">Clientes</h2>
      <div className="grid gap-3">
        {mockClients.map((client) => (
          <div key={client.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="font-medium text-gray-900">{client.name}</p>
            <p className="text-sm text-gray-500">{client.email} · {client.phone}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

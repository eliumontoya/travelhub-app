import Link from "next/link";
import { getClients, getTags, getTripsWithClients } from "@/lib/data";
import { DashboardExplorer } from "./DashboardExplorer";

export default async function DashboardPage() {
  const [clients, trips, tags] = await Promise.all([
    getClients(),
    getTripsWithClients(),
    getTags(),
  ]);

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

      <DashboardExplorer trips={trips} clients={clients} tags={tags} />
    </main>
  );
}

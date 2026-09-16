import { getTravelAgents } from "@/lib/data";
import { TravelAgentCatalogClient } from "./catalog-client";

export default async function TravelAgentsCatalogPage() {
  const agents = await getTravelAgents();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Catálogo</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Agentes de viajes</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Gestiona los agentes que puedes asignar a tus viajes.
          </p>
        </div>
      </div>

      <TravelAgentCatalogClient agents={agents} />
    </main>
  );
}

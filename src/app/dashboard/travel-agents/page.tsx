import { getTravelAgents } from "@/lib/data";
import { TravelAgentCatalogClient } from "./catalog-client";
import { requireFeature } from "@/lib/auth/roles";

export default async function TravelAgentsCatalogPage() {
  await requireFeature("travel-agents");
  const agents = await getTravelAgents();

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Catálogo</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Agentes de viajes</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/82">Gestiona los agentes que puedes asignar a tus viajes.</p>
      </section>

      <TravelAgentCatalogClient agents={agents} />
    </main>
  );
}

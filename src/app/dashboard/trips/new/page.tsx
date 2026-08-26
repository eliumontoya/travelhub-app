import Link from "next/link";
import { ALL_CLIENTS_PAGE_SIZE, getClients, getTags, getTemplates } from "@/lib/data";
import { NewTripForm } from "@/components/NewTripForm";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; clientId?: string }>;
}) {
  const [{ items: clients }, tags, templates, { error, clientId }] = await Promise.all([
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTags(),
    getTemplates(),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard/trips" className="text-sm text-gray-500 hover:underline">
        ← Volver
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-bold text-gray-900">Nuevo viaje</h1>

      <NewTripForm
        clients={clients}
        tags={tags}
        templates={templates}
        error={error}
        clientId={clientId}
      />
    </main>
  );
}

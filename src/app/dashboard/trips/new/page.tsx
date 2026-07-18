import Link from "next/link";
import { getClients } from "@/lib/data";
import { createTripAction } from "./actions";
import { ClientMultiCombobox } from "@/components/ClientMultiCombobox";
import { MinClientsGuard } from "@/components/MinClientsGuard";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; clientId?: string }>;
}) {
  const [clients, { error, clientId }] = await Promise.all([getClients(), searchParams]);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
        ← Volver
      </Link>

      <h1 className="mt-4 mb-6 text-2xl font-bold text-gray-900">Nuevo viaje</h1>

      <form action={createTripAction} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Título</label>
          <input
            name="title"
            required
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Luna de miel en Italia"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Instrucciones</label>
          <textarea
            name="instructions"
            rows={4}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Mensaje de bienvenida, instrucciones de llegada, contactos de emergencia…"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha inicio</label>
            <input
              type="date"
              name="startDate"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Fecha fin</label>
            <input
              type="date"
              name="endDate"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Clientes existentes</label>
          <ClientMultiCombobox
            clients={clients}
            name="clientIds"
            defaultValues={clientId ? [clientId] : []}
          />
          <MinClientsGuard fieldName="clientIds" />
        </div>

        <fieldset className="rounded-lg border border-gray-200 p-4">
          <legend className="px-1 text-sm font-medium text-gray-700">O cliente nuevo</legend>
          <div className="space-y-3">
            <input
              name="newClientName"
              placeholder="Nombre"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                name="newClientEmail"
                placeholder="Email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                name="newClientPhone"
                placeholder="Teléfono"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Crear viaje
        </button>
      </form>
    </main>
  );
}

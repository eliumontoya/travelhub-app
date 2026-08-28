import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getClientById,
  getClientDocuments,
  getClientTags,
  getClientTripSummary,
  getTags,
  getTripsByClientId,
} from "@/lib/data";
import { formatDateShort, formatTags, REFERRAL_SOURCE_OPTIONS } from "@/lib/item-meta";
import { ClientDocuments } from "@/components/ClientDocuments";
import { ClientCoverImage } from "@/components/ClientCoverImage";
import { TripTagsManager } from "@/components/TripTagsManager";
import { RichTextEditor } from "@/components/RichTextEditor";
import { NoteHtml } from "@/components/NoteHtml";
import {
  deleteClientDocumentAction,
  getClientDocumentsAction,
  removeClientCoverAction,
  setClientTagsAction,
  updateClientAction,
  uploadClientCoverAction,
  uploadClientDocumentAction,
} from "./actions";

const documentsEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const coversEnabled = documentsEnabled;

const statusMeta = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600" },
  published: { label: "Publicado", color: "bg-green-100 text-green-700" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400" },
};

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await getClientById(id);
  if (!client) notFound();

  const [trips, tags, clientTags, summary, documents] = await Promise.all([
    getTripsByClientId(id),
    getTags(),
    getClientTags(id),
    getClientTripSummary(id),
    getClientDocuments(id),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      {client.coverImageUrl ? (
        <div className="mb-6 h-40 w-full overflow-hidden rounded-xl border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={client.coverImageUrl} alt="Portada" className="h-full w-full object-cover" />
        </div>
      ) : null}

      <Link href="/dashboard/clients" className="text-sm text-gray-500 hover:underline">
        ← Volver
      </Link>

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{client.name}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {client.email} · {client.phone}
          </p>
          {client.whatsapp && client.whatsapp !== client.phone ? (
            <p className="mt-1 text-sm text-gray-500">WhatsApp: {client.whatsapp}</p>
          ) : null}
          {client.notes && (
            <NoteHtml html={client.notes} className="mt-1 text-sm text-gray-500" />
          )}
          <p className="mt-1 text-xs text-gray-400">
            Alta: {new Date(client.createdAt).toLocaleDateString("es-MX")}
          </p>
          {clientTags.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {formatTags(clientTags).map((name) => (
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
        <div className="flex flex-wrap gap-2">
          <TripTagsManager
            tags={tags}
            assignedTagIds={clientTags.map((t) => t.id)}
            trigger={
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Gestionar tags
              </button>
            }
            onSubmit={setClientTagsAction.bind(null, client.id)}
          />
          <Link
            href={`/dashboard/trips/new?clientId=${client.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo viaje para este cliente
          </Link>
        </div>
      </div>

      <details className="mb-8 rounded-lg border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Editar datos del cliente
        </summary>
        <form
          action={updateClientAction.bind(null, client.id)}
          className="mt-4 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              name="name"
              required
              defaultValue={client.name}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                name="email"
                defaultValue={client.email}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Teléfono</label>
              <input
                name="phone"
                defaultValue={client.phone}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">WhatsApp</label>
              <input
                name="whatsapp"
                defaultValue={client.whatsapp ?? ""}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-gray-400">
                Si lo dejas vacío, se guardará el teléfono como WhatsApp.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Fecha de nacimiento</label>
              <input
                name="birthDate"
                type="date"
                defaultValue={client.birthDate}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <RichTextEditor name="notes" defaultValue={client.notes} placeholder="Preferencias, alertas, contexto del cliente…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Cómo llegó el cliente</label>
            <select
              name="referralSource"
              defaultValue={client.referralSource ?? ""}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Sin especificar</option>
              {REFERRAL_SOURCE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Guardar cambios
          </button>
        </form>
      </details>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-gray-900">{summary.totalTrips}</p>
          <p className="text-xs text-gray-500">Viajes totales</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-green-700">{summary.publishedCount}</p>
          <p className="text-xs text-gray-500">Publicados</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
          <p className="text-xl font-bold text-gray-600">{summary.draftCount}</p>
          <p className="text-xs text-gray-500">Borradores</p>
        </div>
        {summary.totalCost !== null ? (
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-gray-900">
              {summary.totalCost.toLocaleString("es-MX", { style: "currency", currency: "MXN" })}
            </p>
            <p className="text-xs text-gray-500">Gasto total</p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
            <p className="text-xl font-bold text-gray-400">{summary.archivedCount}</p>
            <p className="text-xs text-gray-500">Archivados</p>
          </div>
        )}
      </div>

      <div className="mb-8">
        <ClientCoverImage
          coverImageUrl={client.coverImageUrl}
          coversEnabled={coversEnabled}
          onUpload={uploadClientCoverAction.bind(null, client.id)}
          onRemove={removeClientCoverAction.bind(null, client.id)}
        />
      </div>

      <div className="mb-8">
        <ClientDocuments
          documents={documents}
          documentsEnabled={documentsEnabled}
          onUpload={uploadClientDocumentAction.bind(null, client.id)}
          onDelete={deleteClientDocumentAction.bind(null, client.id)}
          onRefresh={getClientDocumentsAction.bind(null, client.id)}
        />
      </div>

      <h2 className="mb-4 text-lg font-semibold text-gray-900">Viajes</h2>
      {trips.length === 0 ? (
        <p className="text-sm text-gray-500">Este cliente aún no tiene viajes.</p>
      ) : (
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
                    <h3 className="font-semibold text-gray-900">{trip.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
                  </p>
                </div>
                <span className="text-gray-300">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

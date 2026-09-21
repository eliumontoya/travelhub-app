import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import {
  getServiceForClientTrip,
  getServiceWithChecklist,
} from "@/lib/data/services";
import { getTripById } from "@/lib/data";
import { ServiceChecklistItemWithUpload } from "@/types";
import { uploadDocument } from "./actions";

function statusLabel(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  if (status === "processed") return { icon: "✅", text: "Procesado" };
  if (status === "reviewed") return { icon: "✅", text: "Revisado" };
  if (status === "re_upload_requested")
    return { icon: "⚠", text: "Re-subir solicitado" };
  if (status === "uploaded")
    return { icon: "🔄", text: "Pendiente de revisión" };
  return { icon: "⬜", text: "Pendiente" };
}

function canUpload(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  return status === undefined || status === "re_upload_requested";
}

export default async function ClientTripDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getClientSession();
  if (!session) {
    redirect("/client/login?redirectTo=/client");
  }

  const { id: tripId } = await params;
  const service = await getServiceForClientTrip(session.clientId, tripId);
  if (!service) {
    redirect("/client");
  }

  const [checklist, trip] = await Promise.all([
    getServiceWithChecklist(service.id),
    getTripById(service.tripId),
  ]);
  const completed = checklist.items.filter(
    (i) =>
      i.upload?.status === "reviewed" || i.upload?.status === "processed",
  ).length;
  const total = checklist.items.length;
  const tripHref =
    trip?.status === "published" && trip.slug ? `/t/${trip.slug}` : "/client";
  const tripLinkLabel =
    trip?.status === "published" ? "Ver itinerario" : "Ver en mi cuenta";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/client"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            ← Volver a mis viajes
          </Link>
          {trip && (
            <Link
              href={tripHref}
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              {tripLinkLabel}
            </Link>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
          Documentos del viaje
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {completed}/{total} completados
        </p>
      </header>

      {total === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Todavía no hay documentos solicitados para este viaje.
        </p>
      ) : (
        <ul className="space-y-4">
          {checklist.items.map((item) => {
            const { icon, text } = statusLabel(item);
            const uploadAction = uploadDocument.bind(null, service.id, item.id);
            return (
              <li
                key={item.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true">{icon}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {item.label}
                      </span>
                      {item.required && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          *
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {text}
                    </p>
                    {item.upload?.status === "re_upload_requested" &&
                      item.upload.agentComment && (
                        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                          Comentario del agente: {item.upload.agentComment}
                        </p>
                      )}
                  </div>
                  {canUpload(item) && (
                    <form
                      action={uploadAction}
                      className="flex flex-col items-end gap-2"
                    >
                      <label className="sr-only" htmlFor={`file-${item.id}`}>
                        Subir archivo para {item.label}
                      </label>
                      <input
                        id={`file-${item.id}`}
                        name="file"
                        type="file"
                        required
                        className="block w-40 text-xs text-blue-950 file:mr-2 file:rounded file:border-0 file:bg-blue-600 file:px-2 file:py-1 file:text-white dark:text-blue-100"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Subir
                      </button>
                    </form>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

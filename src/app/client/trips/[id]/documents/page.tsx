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
  if (status === "processed") return { icon: "✓", text: "Procesado" };
  if (status === "reviewed") return { icon: "✓", text: "Revisado" };
  if (status === "re_upload_requested") return { icon: "!", text: "Re-subir solicitado" };
  if (status === "uploaded") return { icon: "↻", text: "Pendiente de revisión" };
  return { icon: "□", text: "Pendiente" };
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
    <main className="min-h-screen bg-[#fffaf7] px-4 py-8 text-[var(--operator-ink)]">
      <div className="mx-auto max-w-3xl"><header className="mb-6 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)]">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/client"
            className="text-white/82 hover:text-white hover:underline"
          >
            ← Volver a mis viajes
          </Link>
          {trip && (
            <Link
              href={tripHref}
              className="font-medium text-white/82 hover:text-white hover:underline"
            >
              {tripLinkLabel}
            </Link>
          )}
        </div>
        <h1 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.04em] text-white">
          Documentos del viaje
        </h1>
        <p className="mt-1 text-sm text-white/76">
          {completed}/{total} completados
        </p>
      </header>

      {total === 0 ? (
        <p className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 text-sm text-[var(--operator-ink-muted)] shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
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
                className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-[var(--operator-surface-subtle)] font-bold text-[var(--operator-brand)]">{icon}</span>
                      <span className="font-semibold text-[var(--operator-brand)]">
                        {item.label}
                      </span>
                      {item.required && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          *
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[var(--operator-ink-muted)]">
                      {text}
                    </p>
                    {item.upload?.status === "re_upload_requested" &&
                      item.upload.agentComment && (
                        <p className="mt-2 text-sm text-[var(--operator-brand)]">
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
                        className="block w-40 text-xs text-[var(--operator-ink-muted)] file:mr-2 file:rounded-lg file:border-0 file:bg-[var(--operator-brand)] file:px-2 file:py-1 file:text-white"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-[var(--operator-brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--operator-brand-strong)]"
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
      </div>
    </main>
  );
}

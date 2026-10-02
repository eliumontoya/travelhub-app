import Link from "next/link";
import { redirect } from "next/navigation";
import { getClientSession } from "@/lib/client-auth";
import { getVisaById, getVisaDocuments } from "@/lib/data";
import type { VisaStatus, VisaDocumentStatus } from "@/types";
import { uploadVisaDocumentForRequestAction } from "./actions";

const STATUS_META: Record<VisaStatus, { label: string; classes: string }> = {
  pending: {
    label: "Pendiente",
    classes: "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)]",
  },
  in_progress: {
    label: "En trámite",
    classes: "bg-amber-100 text-amber-800",
  },
  completed: {
    label: "Completada",
    classes: "bg-green-100 text-green-800",
  },
};

const DOCUMENT_STATUS_META: Record<
  VisaDocumentStatus,
  { icon: string; label: string; classes: string }
> = {
  requested: {
    icon: "□",
    label: "Pendiente de subir",
    classes: "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)]",
  },
  uploaded: {
    icon: "↻",
    label: "Pendiente de revisión",
    classes: "bg-blue-100 text-blue-800",
  },
  reviewed: {
    icon: "✓",
    label: "Revisado",
    classes: "bg-emerald-100 text-emerald-800",
  },
  processed: {
    icon: "✓",
    label: "Procesado",
    classes: "bg-green-100 text-green-800",
  },
  re_upload_requested: {
    icon: "!",
    label: "Resubida solicitada",
    classes: "bg-rose-100 text-rose-800",
  },
};

function canUpload(status: VisaDocumentStatus): boolean {
  return status === "requested" || status === "re_upload_requested";
}

function formatDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ClientVisaDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getClientSession();
  if (!session) {
    redirect("/client/login?redirectTo=/client");
  }

  const { id: visaId } = await params;
  const visa = await getVisaById(visaId);
  if (!visa) {
    redirect("/client");
  }

  const isAssigned = visa.clients.some((c) => c.id === session.clientId);
  if (!isAssigned) {
    redirect("/client");
  }

  const documents = await getVisaDocuments(visaId);

  const travelerDocs = documents.filter(
    (d) => d.targetClientId === session.clientId,
  );

  const statusMeta = STATUS_META[visa.status];
  const pendingCount = travelerDocs.filter((d) => canUpload(d.status)).length;
  const completedCount = travelerDocs.filter(
    (d) => d.status === "reviewed" || d.status === "processed",
  ).length;

  return (
    <main className="min-h-screen bg-[#fffaf7] px-4 py-8 text-[var(--operator-ink)]">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)]">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Link
              href="/client"
              className="text-white/82 hover:text-[var(--operator-brand)] hover:underline"
            >
              ← Volver a mi cuenta
            </Link>
          </div>
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-[-0.04em] text-white">
            {visa.country} — {visa.visaType}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/82">
            <span
              data-testid={`visa-status-${visa.status}`}
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.classes}`}
            >
              {statusMeta.label}
            </span>
            <span>·</span>
            <span>Fecha límite {formatDate(visa.deadline)}</span>
            <span>·</span>
            <span>Precio {formatPrice(visa.price)}</span>
          </div>
          <p className="mt-1 text-sm text-white/76">
            {completedCount}/{travelerDocs.length} completados · {pendingCount} pendientes
          </p>
        </header>

        {travelerDocs.length === 0 ? (
          <p
            data-testid="visa-no-documents"
            className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 text-sm text-[var(--operator-ink-muted)] shadow-[0_18px_42px_rgba(81,0,52,0.07)]"
          >
            Todavía no se ha solicitado ningún documento para esta visa.
          </p>
        ) : (
          <ul className="space-y-4">
            {travelerDocs.map((doc) => {
              const meta = DOCUMENT_STATUS_META[doc.status];
              const uploadAction = uploadVisaDocumentForRequestAction.bind(
                null,
                visa.id,
                doc.id,
              );
              return (
                <li
                  key={doc.id}
                  data-testid={`visa-doc-${doc.id}`}
                  className={`rounded-2xl border bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)] ${
                    doc.status === "re_upload_requested"
                      ? "border-rose-200"
                      : "border-[var(--operator-border)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="grid h-8 w-8 place-items-center rounded-full bg-[var(--operator-surface-subtle)] font-bold text-[var(--operator-brand)]"
                        >
                          {meta.icon}
                        </span>
                        <span className="font-semibold text-[var(--operator-brand)]">
                          {doc.description ?? "Documento sin título"}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${meta.classes}`}
                        >
                          {meta.label}
                        </span>
                      </div>
                      {doc.status === "re_upload_requested" && doc.agentComment && (
                        <p className="mt-2 text-sm text-[var(--operator-brand)]">
                          Comentario del agente: {doc.agentComment}
                        </p>
                      )}
                      {doc.filePath && (
                        <p className="mt-1 text-xs text-[var(--operator-ink-muted)]">
                          Archivo: {doc.filename ?? doc.filePath.split("/").pop()}
                        </p>
                      )}
                    </div>
                    {canUpload(doc.status) && (
                      <form
                        action={uploadAction}
                        className="flex flex-col items-end gap-2"
                      >
                        <label
                          className="sr-only"
                          htmlFor={`file-${doc.id}`}
                        >
                          Subir archivo para {doc.description ?? doc.id}
                        </label>
                        <input
                          id={`file-${doc.id}`}
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

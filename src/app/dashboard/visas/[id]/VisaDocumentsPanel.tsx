"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Client, VisaDocument, VisaDocumentStatus } from "@/types";
import {
  markVisaDocumentProcessedAction,
  markVisaDocumentReviewedAction,
  requestVisaDocumentAction,
  requestVisaDocumentReUploadAction,
  uploadVisaDocumentAction,
} from "./actions";

const STATUS_LABEL: Record<VisaDocumentStatus, string> = {
  requested: "Solicitado al viajero",
  uploaded: "Subido",
  reviewed: "Revisado",
  processed: "Procesado",
  re_upload_requested: "Resubida solicitada",
};

const STATUS_CLASSES: Record<VisaDocumentStatus, string> = {
  requested: "bg-amber-100 text-amber-800",
  uploaded: "bg-blue-100 text-blue-800",
  reviewed: "bg-indigo-100 text-indigo-800",
  processed: "bg-green-100 text-green-800",
  re_upload_requested: "bg-rose-100 text-rose-800",
};

type DocumentItem = VisaDocument & { url: string | null };

export function VisaDocumentsPanel({
  visaId,
  initialDocuments,
  assignedClients,
}: {
  visaId: string;
  initialDocuments: DocumentItem[];
  assignedClients: Client[];
}) {
  const router = useRouter();
  // Derived from props on every render: after a server action succeeds and
  // router.refresh() re-renders the server component, the fresh list replaces
  // the stale one without a full page reload.
  const documents = initialDocuments;
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadPending, startUploadTransition] = useTransition();
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestPending, startRequestTransition] = useTransition();
  const [reUploadCommentById, setReUploadCommentById] = useState<Record<string, string>>({});
  const [reUploadErrorById, setReUploadErrorById] = useState<Record<string, string | null>>({});

  function handleUpload(formData: FormData) {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setUploadError("Selecciona un archivo para subir.");
      return;
    }
    setUploadError(null);
    startUploadTransition(async () => {
      const result = await uploadVisaDocumentAction(visaId, file);
      if (!result.ok) {
        setUploadError(result.error ?? "No se pudo subir el documento.");
        return;
      }
      router.refresh();
    });
  }

  function handleRequest(formData: FormData) {
    const clientId = String(formData.get("clientId") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!clientId) {
      setRequestError("Selecciona un viajero.");
      return;
    }
    if (!description) {
      setRequestError("Describe el documento que necesitas.");
      return;
    }
    setRequestError(null);
    startRequestTransition(async () => {
      const result = await requestVisaDocumentAction(visaId, clientId, description);
      if (!result.ok) {
        setRequestError(result.error ?? "No se pudo solicitar el documento.");
        return;
      }
      router.refresh();
    });
  }

  function handleMarkReviewed(documentId: string) {
    startUploadTransition(async () => {
      const result = await markVisaDocumentReviewedAction(documentId);
      if (!result.ok) {
        setUploadError(result.error ?? "No se pudo marcar el documento como revisado.");
        return;
      }
      router.refresh();
    });
  }

  function handleMarkProcessed(documentId: string) {
    startUploadTransition(async () => {
      const result = await markVisaDocumentProcessedAction(documentId);
      if (!result.ok) {
        setUploadError(result.error ?? "No se pudo marcar el documento como procesado.");
        return;
      }
      router.refresh();
    });
  }

  function handleReUpload(documentId: string) {
    const comment = (reUploadCommentById[documentId] ?? "").trim();
    if (!comment) {
      setReUploadErrorById((prev) => ({
        ...prev,
        [documentId]: "Agrega un comentario para el viajero.",
      }));
      return;
    }
    setReUploadErrorById((prev) => ({ ...prev, [documentId]: null }));
    startUploadTransition(async () => {
      const result = await requestVisaDocumentReUploadAction(documentId, comment);
      if (!result.ok) {
        setReUploadErrorById((prev) => ({
          ...prev,
          [documentId]: result.error ?? "No se pudo solicitar la resubida.",
        }));
        return;
      }
      setReUploadCommentById((prev) => {
        const next = { ...prev };
        delete next[documentId];
        return next;
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6" data-testid="visa-documents-panel">
      <form
        action={handleUpload}
        className="space-y-2 rounded-lg border border-dashed border-[var(--operator-border)] p-3"
      >
        <h3 className="text-sm font-semibold text-[var(--operator-ink)]">
          Subir un documento en nombre del viajero
        </h3>
        <input
          type="file"
          name="file"
          required
          className="block w-full text-sm text-[var(--operator-ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--operator-brand)] file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
        />
        <button
          type="submit"
          disabled={uploadPending}
          className="rounded-lg bg-[var(--operator-brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-60"
        >
          {uploadPending ? "Subiendo…" : "Subir"}
        </button>
        {uploadError && (
          <p role="alert" className="text-sm text-[var(--operator-coral)]">
            {uploadError}
          </p>
        )}
      </form>

      <form
        action={handleRequest}
        className="space-y-2 rounded-lg border border-[var(--operator-border)] p-3"
      >
        <h3 className="text-sm font-semibold text-[var(--operator-ink)]">
          Solicitar un documento a un viajero
        </h3>
        {assignedClients.length === 0 ? (
          <p className="text-sm text-[var(--operator-ink-muted)]">
            Asigna al menos un cliente antes de solicitar documentos.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select
                name="clientId"
                required
                defaultValue=""
                className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              >
                <option value="" disabled>
                  Selecciona un viajero
                </option>
                {assignedClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                name="description"
                required
                placeholder="Escaneo del pasaporte, foto, etc."
                className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={requestPending}
              className="rounded-lg bg-[var(--operator-brand)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-60"
            >
              {requestPending ? "Solicitando…" : "Solicitar documento"}
            </button>
          </>
        )}
        {requestError && (
          <p role="alert" className="text-sm text-[var(--operator-coral)]">
            {requestError}
          </p>
        )}
      </form>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
          Documentos en archivo
        </h3>
        {documents.length === 0 ? (
          <p className="text-sm text-[var(--operator-ink-muted)]">
            No hay documentos adjuntos todavía.
          </p>
        ) : (
          <ul className="space-y-3" data-testid="visa-document-list">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="space-y-2 rounded-lg border border-[var(--operator-border-subtle)] bg-[var(--operator-surface-subtle)] p-3"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid={`visa-document-status-${doc.status}`}
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[doc.status]}`}
                  >
                    {STATUS_LABEL[doc.status]}
                  </span>
                  {doc.filename && (
                    <span className="text-sm font-medium text-[var(--operator-ink)]">
                      {doc.filename}
                    </span>
                  )}
                  {doc.description && doc.status === "requested" && (
                    <span className="text-sm text-[var(--operator-ink-muted)]">
                      {doc.description}
                    </span>
                  )}
                  {doc.agentComment && doc.status === "re_upload_requested" && (
                    <span className="text-sm text-[var(--operator-ink-muted)]">
                      Nota: {doc.agentComment}
                    </span>
                  )}
                </div>

                {doc.url && (
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-sm text-[var(--operator-brand)] hover:underline"
                  >
                    Abrir archivo →
                  </a>
                )}

                <div className="flex flex-wrap gap-2">
                  {doc.status === "uploaded" && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleMarkReviewed(doc.id)}
                        disabled={uploadPending}
                        className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-xs font-medium text-[var(--operator-ink)] hover:border-[var(--operator-brand)] disabled:opacity-60"
                      >
                        Marcar revisado
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkProcessed(doc.id)}
                        disabled={uploadPending}
                        className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-xs font-medium text-[var(--operator-ink)] hover:border-[var(--operator-brand)] disabled:opacity-60"
                      >
                        Marcar procesado
                      </button>
                      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                        <input
                          type="text"
                          placeholder="Comentario para la resubida…"
                          value={reUploadCommentById[doc.id] ?? ""}
                          onChange={(e) =>
                            setReUploadCommentById((prev) => ({
                              ...prev,
                              [doc.id]: e.target.value,
                            }))
                          }
                          className="min-w-[12rem] flex-1 rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleReUpload(doc.id)}
                          disabled={uploadPending}
                          className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-xs font-medium text-[var(--operator-ink)] hover:border-[var(--operator-coral)] disabled:opacity-60"
                        >
                          Solicitar resubida
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {reUploadErrorById[doc.id] && (
                  <p role="alert" className="text-sm text-[var(--operator-coral)]">
                    {reUploadErrorById[doc.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

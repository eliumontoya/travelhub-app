"use client";

import { useRef, useState, useTransition } from "react";
import { TripDocument } from "@/types";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_ERROR } from "@/lib/constants";

type DocWithUrl = TripDocument & { url: string | null };

export function TripDocuments({
  documents,
  documentsEnabled,
  onUpload,
  onDelete,
  onRefresh,
}: {
  documents: DocWithUrl[];
  documentsEnabled: boolean;
  onUpload: (formData: FormData) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onRefresh: () => Promise<DocWithUrl[]>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [docs, setDocs] = useState<DocWithUrl[]>(documents);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError(MAX_UPLOAD_ERROR);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      await onUpload(formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setDocs(await onRefresh());
    });
  }

  function handleDelete(documentId: string) {
    if (!confirm("¿Eliminar este documento?")) return;
    startTransition(async () => {
      await onDelete(documentId);
      setDocs(await onRefresh());
    });
  }

  return (
    <div className="rounded-xl border border-[var(--operator-border)] bg-white p-4 sm:p-5 print:hidden dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
      <h3 className="mb-3 font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Documentos del viaje</h3>

      {uploadError && (
        <p className="mb-3 rounded-lg bg-[var(--operator-coral)]/10 px-3 py-2 text-sm text-[var(--operator-coral)] dark:bg-[var(--operator-coral)]/10 dark:text-[var(--operator-coral)]">
          {uploadError}
        </p>
      )}

      {docs.length > 0 ? (
        <ul className="mb-4 space-y-1">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-[var(--operator-brand)] hover:underline dark:text-[var(--operator-gold)]"
                >
                  {doc.filename}
                </a>
              ) : (
                <span className="truncate text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]">{doc.filename}</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={isPending}
                className="shrink-0 text-xs text-[var(--operator-coral)] hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-[var(--operator-ink-subtle)]">Sin documentos.</p>
      )}

      {documentsEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" className="text-sm" />
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-sm text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
          >
            Subir documento
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--operator-ink-subtle)]">Configura Supabase para subir documentos.</p>
      )}
    </div>
  );
}

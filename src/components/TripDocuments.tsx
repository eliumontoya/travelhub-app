"use client";

import { useRef, useState, useTransition } from "react";
import { TripDocument } from "@/types";

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

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
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
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:hidden dark:border-gray-800 dark:bg-gray-900">
      <h3 className="mb-3 font-semibold text-gray-900 dark:text-gray-100">Documentos del viaje</h3>

      {docs.length > 0 ? (
        <ul className="mb-4 space-y-1">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-blue-600 hover:underline dark:text-blue-400"
                >
                  {doc.filename}
                </a>
              ) : (
                <span className="truncate text-gray-700 dark:text-gray-300">{doc.filename}</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                disabled={isPending}
                className="shrink-0 text-xs text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-gray-400">Sin documentos.</p>
      )}

      {documentsEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" className="text-sm" />
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Subir documento
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Configura Supabase para subir documentos.</p>
      )}
    </div>
  );
}

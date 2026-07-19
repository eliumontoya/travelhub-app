"use client";

import { useRef, useState, useTransition } from "react";
import { ClientDocument } from "@/types";

type DocWithUrl = ClientDocument & { url: string | null };

export function ClientDocuments({
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
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">
        Documentos del cliente (pasaporte, identificación, etc.)
      </h3>
      {docs.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
              {doc.url ? (
                <a
                  href={doc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-blue-600 hover:underline"
                >
                  {doc.filename}
                </a>
              ) : (
                <span className="truncate text-gray-700">{doc.filename}</span>
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
        <p className="mt-2 text-sm text-gray-400">Sin documentos.</p>
      )}
      {documentsEnabled ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" className="text-sm" />
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Subir
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-400">Configura Supabase para subir documentos.</p>
      )}
    </div>
  );
}

"use client";

import { ItemDocument } from "@/types";

type DocWithUrl = ItemDocument & { url: string | null };

function DocumentPreview({ doc }: { doc: DocWithUrl }) {
  if (!doc.url) {
    return <span className="truncate text-[var(--operator-ink)]">{doc.fileName}</span>;
  }

  if (doc.mimeType?.startsWith("image/")) {
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-2 text-[var(--operator-brand)] hover:underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={doc.url}
          alt={doc.fileName}
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
        <span className="truncate">{doc.fileName}</span>
      </a>
    );
  }

  if (doc.mimeType === "application/pdf") {
    return (
      <a
        href={doc.url}
        target="_blank"
        rel="noreferrer"
        className="flex min-w-0 items-center gap-2 text-[var(--operator-brand)] hover:underline"
      >
        <span aria-hidden className="shrink-0 text-lg">📄</span>
        <span className="truncate">{doc.fileName}</span>
      </a>
    );
  }

  return (
    <a
      href={doc.url}
      target="_blank"
      rel="noreferrer"
      className="truncate text-[var(--operator-brand)] hover:underline"
    >
      {doc.fileName}
    </a>
  );
}

export function ItemDocumentsSection({
  docs,
  docsLoading,
  uploadError,
  documentsEnabled,
  isPending,
  fileInputRef,
  onUpload,
  onDeleteDocument,
}: {
  docs: DocWithUrl[];
  docsLoading: boolean;
  uploadError: string | null;
  documentsEnabled?: boolean;
  isPending: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onUpload: () => void;
  onDeleteDocument: (documentId: string) => void;
}) {
  return (
    <div className="border-t border-[var(--operator-border)] pt-4">
      <label className="mb-2 block text-sm font-medium text-[var(--operator-ink)]">
        Documentos adjuntos
      </label>
      {uploadError && (
        <p className="mb-2 rounded-lg bg-[var(--operator-coral)]/10 px-3 py-2 text-sm text-[var(--operator-coral)]">
          {uploadError}
        </p>
      )}
      {docsLoading && <p className="text-sm text-[var(--operator-ink-subtle)]">Cargando…</p>}
      {!docsLoading && docs.length > 0 && (
        <ul className="mb-3 space-y-1">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
              <DocumentPreview doc={doc} />
              <button
                type="button"
                onClick={() => onDeleteDocument(doc.id)}
                className="shrink-0 text-xs text-[var(--operator-coral)] hover:underline"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      )}
      {documentsEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" className="text-sm" />
          <button
            type="button"
            onClick={onUpload}
            disabled={isPending}
            className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-sm text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)]"
          >
            Subir
          </button>
        </div>
      ) : (
        <p className="text-sm text-[var(--operator-ink-subtle)]">
          Configura Supabase para subir documentos.
        </p>
      )}
    </div>
  );
}

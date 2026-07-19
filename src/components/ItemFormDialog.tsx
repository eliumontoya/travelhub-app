"use client";

import { useRef, useState, useTransition } from "react";
import { Item, ItemDocument, ItemType } from "@/types";
import { itemTypeMeta } from "@/lib/item-meta";
import { LocationInput } from "@/components/LocationInput";
import { showUndoToast } from "@/components/UndoToast";

const itemTypes = Object.keys(itemTypeMeta) as ItemType[];

type DocWithUrl = ItemDocument & { url: string | null };

export function ItemFormDialog({
  trigger,
  item,
  onSubmit,
  onDelete,
  onUndoDelete,
  onLoadDocuments,
  onUploadDocument,
  onDeleteDocument,
  documentsEnabled,
}: {
  trigger: React.ReactNode;
  item?: Item;
  onSubmit: (formData: FormData) => Promise<void>;
  onDelete?: () => Promise<void>;
  onUndoDelete?: () => Promise<void>;
  onLoadDocuments?: () => Promise<DocWithUrl[]>;
  onUploadDocument?: (formData: FormData) => Promise<void>;
  onDeleteDocument?: (documentId: string) => Promise<void>;
  documentsEnabled?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<DocWithUrl[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
    if (item && onLoadDocuments) {
      setDocsLoading(true);
      onLoadDocuments()
        .then(setDocs)
        .finally(() => setDocsLoading(false));
    }
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (!String(formData.get("title") ?? "").trim()) {
      setError("El título es obligatorio");
      return;
    }
    startTransition(async () => {
      await onSubmit(formData);
      close();
    });
  }

  function handleDelete() {
    if (!onDelete) return;
    if (!confirm("¿Eliminar este item?")) return;
    startTransition(async () => {
      await onDelete();
      close();
      if (onUndoDelete) {
        showUndoToast({ message: "Item eliminado", onUndo: onUndoDelete });
      }
    });
  }

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !onUploadDocument) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      await onUploadDocument(formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (onLoadDocuments) setDocs(await onLoadDocuments());
    });
  }

  function handleDeleteDocument(documentId: string) {
    if (!onDeleteDocument) return;
    if (!confirm("¿Eliminar este documento?")) return;
    startTransition(async () => {
      await onDeleteDocument(documentId);
      if (onLoadDocuments) setDocs(await onLoadDocuments());
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-gray-200 p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-gray-900">
            {item ? "Editar item" : "Agregar item"}
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700">Tipo</label>
            <select
              name="type"
              defaultValue={item?.type ?? "activity"}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              {itemTypes.map((t) => (
                <option key={t} value={t}>
                  {itemTypeMeta[t].icon} {itemTypeMeta[t].label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Título</label>
            <input
              name="title"
              defaultValue={item?.title}
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora inicio</label>
              <input
                type="time"
                name="startTime"
                defaultValue={item?.startTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Hora fin</label>
              <input
                type="time"
                name="endTime"
                defaultValue={item?.endTime}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ubicación</label>
            <LocationInput
              defaultValue={item?.location}
              defaultLat={item?.lat}
              defaultLng={item?.lng}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Código de confirmación
              </label>
              <input
                name="confirmationCode"
                defaultValue={item?.confirmationCode}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Costo</label>
              <input
                type="number"
                step="0.01"
                min="0"
                name="cost"
                defaultValue={item?.cost}
                placeholder="Opcional"
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notas</label>
            <textarea
              name="notes"
              defaultValue={item?.notes}
              rows={2}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Costo</label>
            <input
              type="number"
              step="0.01"
              min="0"
              name="cost"
              defaultValue={item?.cost}
              placeholder="Solo visible internamente salvo que actives el resumen de costos"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          {item && (
            <div className="border-t border-gray-100 pt-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Documentos adjuntos
              </label>
              {docsLoading && <p className="text-sm text-gray-400">Cargando…</p>}
              {!docsLoading && docs.length > 0 && (
                <ul className="mb-3 space-y-1">
                  {docs.map((doc) => (
                    <li key={doc.id} className="flex items-center justify-between gap-2 text-sm">
                      {doc.url ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-blue-600 hover:underline"
                        >
                          {doc.fileName}
                        </a>
                      ) : (
                        <span className="truncate text-gray-700">{doc.fileName}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="shrink-0 text-xs text-red-600 hover:underline"
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
                    onClick={handleUpload}
                    disabled={isPending}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    Subir
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-400">
                  Configura Supabase para subir documentos.
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {onDelete && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-sm text-red-600 hover:underline"
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </form>
      </dialog>
    </>
  );
}

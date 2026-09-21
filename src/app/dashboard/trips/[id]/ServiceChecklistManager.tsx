"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  ServiceChecklistItemWithUpload,
  ServiceDocumentSummary,
  ServiceWithChecklist,
} from "@/types";

type AddChecklistItemAction = (
  serviceId: string,
  formData: FormData,
) => Promise<void>;
type UpdateChecklistItemAction = (
  checklistItemId: string,
  formData: FormData,
) => Promise<void>;
type DeleteChecklistItemAction = (checklistItemId: string) => Promise<void>;
type ReorderChecklistItemsAction = (
  serviceId: string,
  orderedIds: string[],
) => Promise<void>;
type MarkUploadProcessedAction = (uploadId: string) => Promise<void>;
type RequestReUploadAction = (
  uploadId: string,
  formData: FormData,
) => Promise<void>;
type GetServiceChecklistAction = (
  serviceId: string,
) => Promise<ServiceWithChecklist>;

function statusLabel(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  if (status === "processed") return { icon: "✅", text: "Procesado" };
  if (status === "re_upload_requested")
    return { icon: "⚠️", text: "Re-subir solicitado" };
  if (status === "uploaded")
    return { icon: "🔄", text: "Pendiente de revisión" };
  return { icon: "⬜", text: "Pendiente" };
}

function itemHasReviewableUpload(item: ServiceChecklistItemWithUpload) {
  return item.upload?.status === "uploaded";
}

export function ServiceChecklistManager({
  summaries,
  clientNameById,
  isArchived,
  getServiceChecklistAction,
  addChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
  reorderChecklistItemsAction,
  markUploadProcessedAction,
  requestReUploadAction,
}: {
  tripId: string;
  summaries: ServiceDocumentSummary[];
  clientNameById: Record<string, string>;
  isArchived: boolean;
  getServiceChecklistAction: GetServiceChecklistAction;
  addChecklistItemAction: AddChecklistItemAction;
  updateChecklistItemAction: UpdateChecklistItemAction;
  deleteChecklistItemAction: DeleteChecklistItemAction;
  reorderChecklistItemsAction: ReorderChecklistItemsAction;
  markUploadProcessedAction: MarkUploadProcessedAction;
  requestReUploadAction: RequestReUploadAction;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isPending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null,
  );
  const [selectedChecklist, setSelectedChecklist] =
    useState<ServiceWithChecklist | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [reUploadItemId, setReUploadItemId] = useState<string | null>(null);

  async function refreshChecklist(serviceId: string) {
    setDetailError(null);
    try {
      setSelectedChecklist(await getServiceChecklistAction(serviceId));
    } catch (err) {
      setDetailError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los documentos.",
      );
    }
  }

  function runAction(action: () => Promise<void>, refreshServiceId?: string) {
    setGlobalError(null);
    startTransition(async () => {
      try {
        await action();
        if (refreshServiceId) await refreshChecklist(refreshServiceId);
        router.refresh();
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Error inesperado");
      }
    });
  }

  function openChecklist(serviceId: string) {
    setSelectedChecklist(null);
    setSelectedServiceId(serviceId);
    dialogRef.current?.showModal();
    startTransition(() => {
      void refreshChecklist(serviceId);
    });
  }

  function closeChecklist() {
    dialogRef.current?.close();
  }

  function handleDialogClose() {
    const serviceId = selectedServiceId;
    setSelectedServiceId(null);
    setSelectedChecklist(null);
    setEditingItemId(null);
    setReUploadItemId(null);
    if (serviceId) triggerRefs.current[serviceId]?.focus();
  }

  function handleAddItem(
    serviceId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    runAction(async () => {
      await addChecklistItemAction(serviceId, formData);
      form.reset();
    }, serviceId);
  }

  function handleUpdateItem(
    checklistItemId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(async () => {
      await updateChecklistItemAction(checklistItemId, formData);
      setEditingItemId(null);
    });
  }

  function handleDeleteItem(checklistItemId: string) {
    if (!confirm("¿Eliminar este item del checklist?")) return;
    runAction(() => deleteChecklistItemAction(checklistItemId));
  }

  function handleReorder(
    serviceId: string,
    items: ServiceChecklistItemWithUpload[],
    checklistItemId: string,
    direction: "up" | "down",
  ) {
    const index = items.findIndex((item) => item.id === checklistItemId);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || swapWith < 0 || swapWith >= items.length) return;
    const next = [...items];
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    runAction(() =>
      reorderChecklistItemsAction(
        serviceId,
        next.map((item) => item.id),
      ),
    );
  }

  function handleMarkProcessed(uploadId: string) {
    runAction(() => markUploadProcessedAction(uploadId));
  }

  function handleRequestReUpload(
    uploadId: string,
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    runAction(async () => {
      await requestReUploadAction(uploadId, formData);
      setReUploadItemId(null);
    });
  }

  if (summaries.length === 0) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Documentos por cliente
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          No hay clientes asignados a este viaje.
        </p>
      </section>
    );
  }

  const selectedClientName = selectedChecklist
    ? (clientNameById[selectedChecklist.clientId] ?? "Cliente")
    : "Documentos del viajero";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Documentos por cliente
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Revisa el avance sin cargar documentos hasta abrir un viajero.
          </p>
        </div>
      </div>

      {globalError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
        >
          {globalError}
        </p>
      )}

      <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-900">
        {summaries.map((summary) => {
          const clientName = clientNameById[summary.clientId] ?? "Cliente";
          const reviewLabel =
            summary.awaitingReview === 1
              ? "pendiente de revisión"
              : "pendientes de revisión";
          return (
            <li
              key={summary.serviceId}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="min-w-0">
                <h3 className="font-medium text-gray-900 dark:text-gray-100">
                  {clientName}
                </h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  {summary.processed}/{summary.total} procesados
                  {summary.awaitingReview > 0
                    ? ` · ${summary.awaitingReview} ${reviewLabel}`
                    : ""}
                </p>
              </div>
              <button
                ref={(element) => {
                  triggerRefs.current[summary.serviceId] = element;
                }}
                type="button"
                onClick={() => openChecklist(summary.serviceId)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Documentos
              </button>
            </li>
          );
        })}
      </ul>

      <dialog
        ref={dialogRef}
        onClose={handleDialogClose}
        aria-labelledby="service-checklist-dialog-title"
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-gray-200 p-0 backdrop:bg-black/40 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 p-5 dark:border-gray-800">
          <div>
            <h3
              id="service-checklist-dialog-title"
              className="text-lg font-semibold text-gray-900 dark:text-gray-100"
            >
              {selectedClientName}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Checklist de documentos
            </p>
          </div>
          <button
            type="button"
            onClick={closeChecklist}
            className="rounded-lg px-2 py-1 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          >
            Cerrar
          </button>
        </div>

        <div
          aria-label="Contenido del checklist"
          className="max-h-[min(65vh,42rem)] overflow-y-auto p-5"
        >
          {detailError && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
            >
              {detailError}
            </p>
          )}
          {!detailError && !selectedChecklist && (
            <p
              aria-live="polite"
              className="text-sm text-gray-500 dark:text-gray-400"
            >
              Cargando documentos…
            </p>
          )}
          {selectedChecklist && (
            <div className="space-y-4">
              {selectedChecklist.items.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Sin documentos solicitados.
                </p>
              ) : (
                <ul className="space-y-3">
                  {selectedChecklist.items.map((item, index) => {
                    const { icon, text } = statusLabel(item);
                    const isEditing = editingItemId === item.id;
                    const isRequestingReUpload = reUploadItemId === item.id;
                    return (
                      <li
                        key={item.id}
                        className="rounded-lg border border-gray-100 p-3 dark:border-gray-800"
                      >
                        {isEditing ? (
                          <form
                            onSubmit={(event) =>
                              handleUpdateItem(item.id, event)
                            }
                            className="flex flex-col gap-2"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                name="label"
                                defaultValue={item.label}
                                required
                                className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                              />
                              <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                  name="required"
                                  type="checkbox"
                                  defaultChecked={item.required}
                                  value="on"
                                />{" "}
                                Obligatorio
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="submit"
                                disabled={isPending}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                disabled={isPending}
                                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                              >
                                Cancelar
                              </button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span aria-hidden="true">{icon}</span>
                                  <span className="font-medium text-gray-900 dark:text-gray-100">
                                    {item.label}
                                  </span>
                                  {item.required && (
                                    <span className="text-xs text-red-600 dark:text-red-400">
                                      *
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {text}
                                </p>
                                {item.upload && (
                                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                    {item.upload.filename}
                                  </p>
                                )}
                                {item.upload?.status ===
                                  "re_upload_requested" &&
                                  item.upload.agentComment && (
                                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                      Comentario: {item.upload.agentComment}
                                    </p>
                                  )}
                              </div>
                              {!isArchived && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    disabled={isPending || index === 0}
                                    onClick={() =>
                                      handleReorder(
                                        selectedChecklist.id,
                                        selectedChecklist.items,
                                        item.id,
                                        "up",
                                      )
                                    }
                                    className="px-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25"
                                    aria-label="Mover arriba"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      isPending ||
                                      index ===
                                        selectedChecklist.items.length - 1
                                    }
                                    onClick={() =>
                                      handleReorder(
                                        selectedChecklist.id,
                                        selectedChecklist.items,
                                        item.id,
                                        "down",
                                      )
                                    }
                                    className="px-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25"
                                    aria-label="Mover abajo"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingItemId(item.id)}
                                    disabled={isPending}
                                    className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                    aria-label="Editar documento"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    disabled={isPending}
                                    className="text-sm text-red-400 hover:text-red-600"
                                    aria-label="Eliminar documento"
                                  >
                                    🗑️
                                  </button>
                                </div>
                              )}
                            </div>
                            {!isArchived &&
                              itemHasReviewableUpload(item) &&
                              item.upload && (
                                <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                                  {isRequestingReUpload ? (
                                    <form
                                      onSubmit={(event) =>
                                        handleRequestReUpload(
                                          item.upload!.id,
                                          event,
                                        )
                                      }
                                      className="flex flex-col gap-2"
                                    >
                                      <textarea
                                        name="comment"
                                        placeholder="¿Por qué se solicita re-subir?"
                                        required
                                        rows={2}
                                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-950"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="submit"
                                          disabled={isPending}
                                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                        >
                                          Solicitar re-subida
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReUploadItemId(null)
                                          }
                                          disabled={isPending}
                                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </form>
                                  ) : (
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleMarkProcessed(item.upload!.id)
                                        }
                                        disabled={isPending}
                                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Marcar procesado
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReUploadItemId(item.id)
                                        }
                                        disabled={isPending}
                                        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                                      >
                                        Solicitar re-subida
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {!isArchived && (
                <form
                  onSubmit={(event) =>
                    handleAddItem(selectedChecklist.id, event)
                  }
                  className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"
                >
                  <input
                    name="label"
                    placeholder="Nuevo documento solicitado"
                    required
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                  />
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      name="required"
                      type="checkbox"
                      defaultChecked
                      value="on"
                    />{" "}
                    Obligatorio
                  </label>
                  <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </dialog>
    </section>
  );
}

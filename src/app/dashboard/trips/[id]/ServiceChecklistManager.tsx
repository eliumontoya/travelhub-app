"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ServiceChecklistItemWithUpload, ServiceWithChecklist } from "@/types";

type AddChecklistItemAction = (
  serviceId: string,
  formData: FormData
) => Promise<void>;
type UpdateChecklistItemAction = (
  checklistItemId: string,
  formData: FormData
) => Promise<void>;
type DeleteChecklistItemAction = (checklistItemId: string) => Promise<void>;
type ReorderChecklistItemsAction = (
  serviceId: string,
  orderedIds: string[]
) => Promise<void>;
type MarkUploadProcessedAction = (uploadId: string) => Promise<void>;
type RequestReUploadAction = (
  uploadId: string,
  formData: FormData
) => Promise<void>;

function statusLabel(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  if (status === "processed") return { icon: "✅", text: "Procesado" };
  if (status === "re_upload_requested")
    return { icon: "⚠️", text: "Re-subir solicitado" };
  if (status === "uploaded") return { icon: "🔄", text: "Pendiente de revisión" };
  return { icon: "⬜", text: "Pendiente" };
}

function itemHasReviewableUpload(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  return status === "uploaded" || status === "re_upload_requested";
}

export function ServiceChecklistManager({
  tripId,
  servicesWithChecklists,
  clientNameById,
  isEditable,
  addChecklistItemAction,
  updateChecklistItemAction,
  deleteChecklistItemAction,
  reorderChecklistItemsAction,
  markUploadProcessedAction,
  requestReUploadAction,
}: {
  tripId: string;
  servicesWithChecklists: ServiceWithChecklist[];
  clientNameById: Record<string, string>;
  isEditable: boolean;
  addChecklistItemAction: AddChecklistItemAction;
  updateChecklistItemAction: UpdateChecklistItemAction;
  deleteChecklistItemAction: DeleteChecklistItemAction;
  reorderChecklistItemsAction: ReorderChecklistItemsAction;
  markUploadProcessedAction: MarkUploadProcessedAction;
  requestReUploadAction: RequestReUploadAction;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [reUploadItemId, setReUploadItemId] = useState<string | null>(null);

  function runAction(action: () => Promise<void>) {
    setGlobalError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setGlobalError(err instanceof Error ? err.message : "Error inesperado");
      }
    });
  }

  function handleAddItem(serviceId: string, e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    runAction(() => addChecklistItemAction(serviceId, formData));
    e.currentTarget.reset();
  }

  function handleUpdateItem(
    checklistItemId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
    direction: "up" | "down"
  ) {
    const idx = items.findIndex((i) => i.id === checklistItemId);
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapWith < 0 || swapWith >= items.length) return;
    const next = [...items];
    [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
    runAction(() => reorderChecklistItemsAction(serviceId, next.map((i) => i.id)));
  }

  function handleMarkProcessed(uploadId: string) {
    runAction(() => markUploadProcessedAction(uploadId));
  }

  function handleRequestReUpload(
    uploadId: string,
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    runAction(async () => {
      await requestReUploadAction(uploadId, formData);
      setReUploadItemId(null);
    });
  }

  if (servicesWithChecklists.length === 0) {
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

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Documentos por cliente
        </h2>
      </div>

      {globalError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {globalError}
        </p>
      )}

      {servicesWithChecklists.map((service) => {
        const clientName = clientNameById[service.clientId] ?? "Cliente";
        return (
          <div
            key={service.id}
            className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
          >
            <h3 className="font-medium text-gray-900 dark:text-gray-100">
              {clientName}
            </h3>

            {service.items.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Sin documentos solicitados.
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {service.items.map((item, idx) => {
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
                          onSubmit={(e) => handleUpdateItem(item.id, e)}
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
                              />
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
                              {item.upload?.status === "re_upload_requested" &&
                                item.upload.agentComment && (
                                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                                    Comentario: {item.upload.agentComment}
                                  </p>
                                )}
                            </div>
                            {isEditable && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isPending || idx === 0}
                                  onClick={() =>
                                    handleReorder(service.id, service.items, item.id, "up")
                                  }
                                  className="px-1 text-xs text-gray-400 hover:text-gray-700 disabled:opacity-25"
                                  aria-label="Mover arriba"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending || idx === service.items.length - 1}
                                  onClick={() =>
                                    handleReorder(service.id, service.items, item.id, "down")
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
                                >
                                  ✏️
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  disabled={isPending}
                                  className="text-sm text-red-400 hover:text-red-600"
                                >
                                  🗑️
                                </button>
                              </div>
                            )}
                          </div>

                          {isEditable && itemHasReviewableUpload(item) && item.upload && (
                            <div className="mt-3 flex flex-col gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                              {isRequestingReUpload ? (
                                <form
                                  onSubmit={(e) =>
                                    handleRequestReUpload(item.upload!.id, e)
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
                                      onClick={() => setReUploadItemId(null)}
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
                                    onClick={() => setReUploadItemId(item.id)}
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

            {isEditable && (
              <form
                onSubmit={(e) => handleAddItem(service.id, e)}
                className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"
              >
                <input
                  name="label"
                  placeholder="Nuevo documento solicitado"
                  required
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-950"
                />
                <label className="flex items-center gap-1.5 text-sm text-gray-700 dark:text-gray-300">
                  <input name="required" type="checkbox" defaultChecked value="on" />
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
        );
      })}
    </section>
  );
}

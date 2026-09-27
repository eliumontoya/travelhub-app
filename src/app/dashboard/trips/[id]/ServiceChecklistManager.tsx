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
type MarkUploadReviewedAction = (uploadId: string) => Promise<void>;
type RequestReUploadAction = (
  uploadId: string,
  formData: FormData,
) => Promise<void>;
type GetServiceChecklistAction = (
  serviceId: string,
) => Promise<ServiceWithChecklist>;

function statusLabel(item: ServiceChecklistItemWithUpload) {
  const status = item.upload?.status;
  if (status === "processed") return { icon: "✓", text: "Procesado" };
  if (status === "reviewed") return { icon: "✓", text: "Revisado" };
  if (status === "re_upload_requested")
    return { icon: "!", text: "Re-subir solicitado" };
  if (status === "uploaded")
    return { icon: "↻", text: "Pendiente de revisión" };
  return { icon: "□", text: "Pendiente" };
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
  markUploadReviewedAction,
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
  markUploadReviewedAction: MarkUploadReviewedAction;
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

  function handleMarkReviewed(uploadId: string) {
    runAction(() => markUploadReviewedAction(uploadId));
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
      <section className="rounded-xl border border-[var(--operator-border)] bg-white p-4 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
        <h2 className="text-sm font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
          Documentos por cliente
        </h2>
        <p className="mt-2 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
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
          <h2 className="text-sm font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
            Documentos por cliente
          </h2>
          <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
            Revisa el avance sin cargar documentos hasta abrir un viajero.
          </p>
        </div>
      </div>

      {globalError && (
        <p
          role="alert"
          className="rounded-lg bg-[var(--operator-coral)]/10 px-3 py-2 text-sm text-[var(--operator-coral)] dark:bg-[var(--operator-coral)]/10 dark:text-[var(--operator-coral)]"
        >
          {globalError}
        </p>
      )}

      <ul className="divide-y divide-[var(--operator-border)] overflow-hidden rounded-xl border border-[var(--operator-border)] bg-white dark:divide-[var(--operator-border)] dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
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
                <h3 className="font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
                  {clientName}
                </h3>
                <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
                  {summary.processed}/{summary.total} revisados
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
                className="rounded-lg border border-[var(--operator-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] disabled:opacity-50 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
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
        className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--operator-border)] p-5 dark:border-[var(--operator-border)]">
          <div>
            <h3
              id="service-checklist-dialog-title"
              className="text-lg font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]"
            >
              {selectedClientName}
            </h3>
            <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
              Checklist de documentos
            </p>
          </div>
          <button
            type="button"
            onClick={closeChecklist}
            className="rounded-lg px-2 py-1 text-sm font-medium text-[var(--operator-ink-muted)] hover:bg-[var(--operator-surface-subtle)] hover:text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)] dark:hover:text-[var(--operator-brand)]"
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
              className="rounded-lg bg-[var(--operator-coral)]/10 px-3 py-2 text-sm text-[var(--operator-coral)] dark:bg-[var(--operator-coral)]/10 dark:text-[var(--operator-coral)]"
            >
              {detailError}
            </p>
          )}
          {!detailError && !selectedChecklist && (
            <p
              aria-live="polite"
              className="text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]"
            >
              Cargando documentos…
            </p>
          )}
          {selectedChecklist && (
            <div className="space-y-4">
              {selectedChecklist.items.length === 0 ? (
                <p className="text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
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
                        className="rounded-lg border border-[var(--operator-border)] p-3 dark:border-[var(--operator-border)]"
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
                                className="min-w-0 flex-1 rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-sm dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]"
                              />
                              <label className="flex items-center gap-1.5 text-sm text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]">
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
                                className="rounded-lg bg-[var(--operator-brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingItemId(null)}
                                disabled={isPending}
                                className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-xs font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
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
                                  <span className="font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
                                    {item.label}
                                  </span>
                                  {item.required && (
                                    <span className="text-xs text-[var(--operator-coral)] dark:text-[var(--operator-coral)]">
                                      *
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
                                  {text}
                                </p>
                                {item.upload && (
                                  <div className="mt-1 text-xs text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
                                    {item.upload.url && !item.upload.fileRemoved ? (
                                      <a
                                        href={item.upload.url}
                                        download={item.upload.filename}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="font-medium text-[var(--operator-brand)] underline underline-offset-2 hover:text-[var(--operator-brand)] dark:text-[var(--operator-gold)] dark:hover:text-[var(--operator-brand)]"
                                      >
                                        Descargar {item.upload.filename}
                                      </a>
                                    ) : (
                                      item.upload.filename
                                    )}
                                  </div>
                                )}
                                {item.upload?.status ===
                                  "re_upload_requested" &&
                                  item.upload.agentComment && (
                                    <p className="mt-1 text-xs text-[var(--operator-brand)] dark:text-[var(--operator-gold)]">
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
                                    className="px-1 text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink)] disabled:opacity-25"
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
                                    className="px-1 text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink)] disabled:opacity-25"
                                    aria-label="Mover abajo"
                                  >
                                    ▼
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingItemId(item.id)}
                                    disabled={isPending}
                                    className="text-sm text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-muted)] dark:hover:text-[var(--operator-ink-subtle)]"
                                    aria-label="Editar documento"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    disabled={isPending}
                                    className="text-sm text-[var(--operator-coral)] hover:text-[var(--operator-coral)]"
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
                                <div className="mt-3 flex flex-col gap-2 border-t border-[var(--operator-border)] pt-2 dark:border-[var(--operator-border)]">
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
                                        className="w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="submit"
                                          disabled={isPending}
                                          className="rounded-lg bg-[var(--operator-gold)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--operator-accent-strong)] disabled:opacity-50"
                                        >
                                          Solicitar re-subida
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setReUploadItemId(null)
                                          }
                                          disabled={isPending}
                                          className="rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-xs font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
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
                                          handleMarkReviewed(item.upload!.id)
                                        }
                                        disabled={isPending}
                                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                                      >
                                        Marcar como revisado
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setReUploadItemId(item.id)
                                        }
                                        disabled={isPending}
                                        className="rounded-lg bg-[var(--operator-gold)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--operator-accent-strong)] disabled:opacity-50"
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
                  className="flex flex-wrap items-center gap-2 border-t border-[var(--operator-border)] pt-3 dark:border-[var(--operator-border)]"
                >
                  <input
                    name="label"
                    placeholder="Nuevo documento solicitado"
                    required
                    className="min-w-0 flex-1 rounded-lg border border-[var(--operator-border)] px-3 py-1.5 text-sm dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]"
                  />
                  <label className="flex items-center gap-1.5 text-sm text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]">
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
                    className="rounded-lg bg-[var(--operator-brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
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

"use client";

import {
  useServiceChecklist,
  type AddChecklistItemAction,
  type DeleteChecklistItemAction,
  type GetServiceChecklistAction,
  type MarkUploadReviewedAction,
  type ReorderChecklistItemsAction,
  type RequestReUploadAction,
  type UpdateChecklistItemAction,
} from "./service-checklist/useServiceChecklist";
import { ChecklistItemRow } from "./service-checklist/ChecklistItemRow";
import type { ServiceDocumentSummary } from "@/types";

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
  const {
    isPending,
    globalError,
    detailError,
    selectedChecklist,
    editingItemId,
    reUploadItemId,
    setEditingItemId,
    setReUploadItemId,
    dialogRef,
    triggerRefs,
    openChecklist,
    closeChecklist,
    handleDialogClose,
    handleAddItem,
    handleUpdateItem,
    handleDeleteItem,
    handleReorder,
    handleMarkReviewed,
    handleRequestReUpload,
  } = useServiceChecklist({
    actions: {
      getServiceChecklistAction,
      addChecklistItemAction,
      updateChecklistItemAction,
      deleteChecklistItemAction,
      reorderChecklistItemsAction,
      markUploadReviewedAction,
      requestReUploadAction,
    },
  });

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
                  {selectedChecklist.items.map((item, index) => (
                    <ChecklistItemRow
                      key={item.id}
                      item={item}
                      index={index}
                      itemsLength={selectedChecklist.items.length}
                      isArchived={isArchived}
                      isPending={isPending}
                      isEditing={editingItemId === item.id}
                      isRequestingReUpload={reUploadItemId === item.id}
                      onStartEdit={() => setEditingItemId(item.id)}
                      onCancelEdit={() => setEditingItemId(null)}
                      onSubmitEdit={(event) => handleUpdateItem(item.id, event)}
                      onDelete={() => handleDeleteItem(item.id)}
                      onReorder={(direction) =>
                        handleReorder(
                          selectedChecklist.id,
                          selectedChecklist.items,
                          item.id,
                          direction,
                        )
                      }
                      onMarkReviewed={() => handleMarkReviewed(item.upload!.id)}
                      onStartReUpload={() => setReUploadItemId(item.id)}
                      onCancelReUpload={() => setReUploadItemId(null)}
                      onSubmitReUpload={(event) =>
                        handleRequestReUpload(item.upload!.id, event)
                      }
                    />
                  ))}
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

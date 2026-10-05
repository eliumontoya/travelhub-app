"use client";

import type { ServiceChecklistItemWithUpload } from "@/types";
import { itemHasReviewableUpload, statusLabel } from "./useServiceChecklist";

export function ChecklistItemRow({
  item,
  index,
  itemsLength,
  isArchived,
  isPending,
  isEditing,
  isRequestingReUpload,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onDelete,
  onReorder,
  onMarkReviewed,
  onStartReUpload,
  onCancelReUpload,
  onSubmitReUpload,
}: {
  item: ServiceChecklistItemWithUpload;
  index: number;
  itemsLength: number;
  isArchived: boolean;
  isPending: boolean;
  isEditing: boolean;
  isRequestingReUpload: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSubmitEdit: (event: React.FormEvent<HTMLFormElement>) => void;
  onDelete: () => void;
  onReorder: (direction: "up" | "down") => void;
  onMarkReviewed: () => void;
  onStartReUpload: () => void;
  onCancelReUpload: () => void;
  onSubmitReUpload: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { icon, text } = statusLabel(item);
  return (
    <li
      key={item.id}
      className="rounded-lg border border-[var(--operator-border)] p-3 dark:border-[var(--operator-border)]"
    >
      {isEditing ? (
        <form
          onSubmit={(event) => onSubmitEdit(event)}
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
              onClick={onCancelEdit}
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
              {item.upload?.status === "re_upload_requested" &&
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
                  onClick={() => onReorder("up")}
                  className="px-1 text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink)] disabled:opacity-25"
                  aria-label="Mover arriba"
                >
                  ▲
                </button>
                <button
                  type="button"
                  disabled={isPending || index === itemsLength - 1}
                  onClick={() => onReorder("down")}
                  className="px-1 text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink)] disabled:opacity-25"
                  aria-label="Mover abajo"
                >
                  ▼
                </button>
                <button
                  type="button"
                  onClick={onStartEdit}
                  disabled={isPending}
                  className="text-sm text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-muted)] dark:hover:text-[var(--operator-ink-subtle)]"
                  aria-label="Editar documento"
                >
                  ✏️
                </button>
                <button
                  type="button"
                  onClick={onDelete}
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
                    onSubmit={(event) => onSubmitReUpload(event)}
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
                        onClick={onCancelReUpload}
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
                      onClick={onMarkReviewed}
                      disabled={isPending}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Marcar como revisado
                    </button>
                    <button
                      type="button"
                      onClick={onStartReUpload}
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
}

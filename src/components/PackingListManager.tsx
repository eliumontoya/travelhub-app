"use client";

import { useRef, useState, useTransition } from "react";
import { PackingItem } from "@/types";

export function PackingListManager({
  items,
  onAdd,
  onToggle,
  onDelete,
  readOnly = false,
  title = "Checklist de equipaje",
}: {
  items: PackingItem[];
  onAdd?: (formData: FormData) => Promise<void>;
  onToggle?: (itemId: string, checked: boolean) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
  readOnly?: boolean;
  title?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [localChecked, setLocalChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((item) => [item.id, item.checked]))
  );

  if (readOnly && items.length === 0) return null;

  const checkedOf = (item: PackingItem) =>
    readOnly ? (localChecked[item.id] ?? item.checked) : item.checked;

  const handleToggle = (item: PackingItem, checked: boolean) => {
    if (readOnly) {
      setLocalChecked((prev) => ({ ...prev, [item.id]: checked }));
      return;
    }
    startTransition(() => onToggle!(item.id, checked));
  };

  return (
    <div className="rounded-xl border border-[var(--operator-border)] bg-white p-4 sm:p-5 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
      <h3 className="mb-3 font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{title}</h3>

      <ul className="mb-3 space-y-2">
        {items.map((item) => {
          const checked = checkedOf(item);
          return (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={checked}
                disabled={isPending}
                onChange={(e) => handleToggle(item, e.target.checked)}
                className="h-4 w-4 rounded border-[var(--operator-border)]"
              />
              <span className={`flex-1 text-sm ${checked ? "text-[var(--operator-ink-subtle)] line-through" : "text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]"}`}>
                {item.label}
              </span>
              {!readOnly && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => startTransition(() => onDelete!(item.id))}
                  className="text-xs text-[var(--operator-ink-subtle)] hover:text-[var(--operator-coral)]"
                  aria-label={`Eliminar ${item.label}`}
                >
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {!readOnly && (
        <form
          ref={formRef}
          action={(formData) => {
            startTransition(async () => {
              await onAdd!(formData);
              formRef.current?.reset();
            });
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            name="label"
            placeholder="Agregar item (ej. Protector solar)"
            className="flex-1 rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)]"
          >
            + Agregar
          </button>
        </form>
      )}
    </div>
  );
}

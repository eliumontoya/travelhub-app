"use client";

import { useRef, useTransition } from "react";
import { PackingItem } from "@/types";

export function PackingListManager({
  items,
  onAdd,
  onToggle,
  onDelete,
}: {
  items: PackingItem[];
  onAdd: (formData: FormData) => Promise<void>;
  onToggle: (itemId: string, checked: boolean) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="mb-3 font-semibold text-gray-900">Checklist de equipaje</h3>

      {items.length > 0 && (
        <ul className="mb-3 space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.checked}
                disabled={isPending}
                onChange={(e) => {
                  const checked = e.target.checked;
                  startTransition(() => onToggle(item.id, checked));
                }}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className={`flex-1 text-sm ${item.checked ? "text-gray-400 line-through" : "text-gray-700"}`}>
                {item.label}
              </span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => startTransition(() => onDelete(item.id))}
                className="text-xs text-gray-400 hover:text-red-500"
                aria-label={`Eliminar ${item.label}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        ref={formRef}
        action={(formData) => {
          startTransition(async () => {
            await onAdd(formData);
            formRef.current?.reset();
          });
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          name="label"
          placeholder="Agregar item (ej. Protector solar)"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          + Agregar
        </button>
      </form>
    </div>
  );
}

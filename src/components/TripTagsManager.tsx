"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Tag } from "@/types";
import { TagMultiCombobox } from "@/components/TagMultiCombobox";

// Dialog de gestión de tags asignados a un viaje. Clon de TripClientsManager
// pero SIN el guard de mínimo 1 (0 tags es válido, a diferencia de clientes).
export function TripTagsManager({
  trigger,
  tags,
  assignedTagIds,
  onSubmit,
}: {
  trigger: React.ReactNode;
  tags: Tag[];
  assignedTagIds: string[];
  onSubmit: (formData: FormData) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function open() {
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      try {
        await onSubmit(formData);
        router.refresh();
        close();
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudieron guardar los cambios.");
      }
    });
  }

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-[var(--operator-border)] p-0 backdrop:bg-black/40"
      >
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Gestionar tags</h3>

          <div>
            <label className="block text-sm font-medium text-[var(--operator-ink)]">Tags asignados</label>
            <TagMultiCombobox tags={tags} defaultTagIds={assignedTagIds} />
          </div>

          {error && <p className="text-sm text-[var(--operator-coral)]">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

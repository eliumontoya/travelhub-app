"use client";

import { useActionState, type KeyboardEvent } from "react";
import type { Item } from "@/types";
import {
  createTravelerActivityAction,
  deleteTravelerActivityAction,
  type TravelerActivityActionState,
  updateTravelerActivityAction,
} from "@/app/t/[slug]/actions";
import { OperatorButton } from "@/components/ui/OperatorButton";

type TravelerActivityFormProps = {
  tripId: string;
  tripDayId: string;
  slug: string;
  item?: Pick<Item, "id" | "title" | "startTime" | "location" | "notes">;
};

type BoundTravelerActivityAction = (
  previousState: TravelerActivityActionState,
  formData: FormData
) => Promise<TravelerActivityActionState>;

const initialTravelerActivityActionState: TravelerActivityActionState = { status: "idle" };

function ActionFeedback({ state }: { state: TravelerActivityActionState }) {
  if (state.status === "idle" || !state.message) return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`text-sm ${state.status === "error" ? "text-red-700 dark:text-red-300" : "text-[var(--operator-brand)]"}`}
    >
      {state.message}
    </p>
  );
}

export function isTravelerActivitySubmitShortcut({
  key,
  ctrlKey,
  metaKey,
}: Pick<KeyboardEvent<HTMLTextAreaElement>, "key" | "ctrlKey" | "metaKey">): boolean {
  return key === "Enter" && (ctrlKey || metaKey);
}

function submitOnShortcut(event: KeyboardEvent<HTMLTextAreaElement>) {
  if (isTravelerActivitySubmitShortcut(event)) {
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
}

function DeleteTravelerActivityButton({ action }: { action: BoundTravelerActivityAction }) {
  const [state, formAction, isPending] = useActionState(action, initialTravelerActivityActionState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <button
        type="submit"
        disabled={isPending}
        className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)] disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
      >
        {isPending ? "Eliminando…" : "Eliminar"}
      </button>
      <ActionFeedback state={state} />
    </form>
  );
}

export function TravelerActivityForm({ tripId, tripDayId, slug, item }: TravelerActivityFormProps) {
  const isEditing = Boolean(item);
  const action: BoundTravelerActivityAction = isEditing
    ? updateTravelerActivityAction.bind(null, tripId, tripDayId, item!.id, slug)
    : createTravelerActivityAction.bind(null, tripId, tripDayId, slug);
  const deleteAction = item
    ? deleteTravelerActivityAction.bind(null, tripId, tripDayId, item.id, slug)
    : null;
  const [state, formAction, isPending] = useActionState(action, initialTravelerActivityActionState);

  const fields = (
    <>
      <label className="grid gap-1.5 text-sm font-medium text-[var(--operator-ink)] sm:col-span-2">
        Actividad
        <input
          name="title"
          defaultValue={item?.title}
          maxLength={120}
          required
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-base text-[var(--operator-ink)] outline-none placeholder:text-[var(--operator-ink-subtle)] focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-surface-hover)]"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-[var(--operator-ink)]">
        Hora <span className="font-normal text-[var(--operator-ink-muted)]">(opcional)</span>
        <input
          type="time"
          name="startTime"
          defaultValue={item?.startTime ?? ""}
          className="min-h-11 w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-base text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-surface-hover)]"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-[var(--operator-ink)]">
        Lugar <span className="font-normal text-[var(--operator-ink-muted)]">(opcional)</span>
        <input
          name="location"
          defaultValue={item?.location ?? ""}
          maxLength={200}
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-base text-[var(--operator-ink)] outline-none placeholder:text-[var(--operator-ink-subtle)] focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-surface-hover)]"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-[var(--operator-ink)] sm:col-span-2">
        Notas <span className="font-normal text-[var(--operator-ink-muted)]">(opcional)</span>
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          maxLength={2000}
          rows={3}
          onKeyDown={submitOnShortcut}
          className="w-full rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 py-2 text-base text-[var(--operator-ink)] outline-none placeholder:text-[var(--operator-ink-subtle)] focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-surface-hover)]"
        />
      </label>
    </>
  );

  const form = (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {fields}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <OperatorButton
          type="submit"
          disabled={isPending}
          className="min-h-11"
        >
          {isPending ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar actividad"}
        </OperatorButton>
        <ActionFeedback state={state} />
      </div>
    </form>
  );

  if (!isEditing) {
    return (
      <section className="mt-5 border-t border-[var(--operator-border-subtle)] pt-4 print:hidden">
        <h3 className="text-base font-semibold text-[var(--operator-ink)]">Agregar una actividad</h3>
        <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">Completá los datos y usá Ctrl o ⌘ + Enter en las notas para guardar.</p>
        <div className="mt-4">{form}</div>
      </section>
    );
  }

  return (
    <details className="print:hidden">
      <summary className="min-h-10 cursor-pointer rounded-[var(--operator-radius-control)] px-3 py-2 text-sm font-medium text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]">
        Editar actividad
      </summary>
      <div className="mt-3 space-y-3 rounded-[var(--operator-radius-control)] bg-[var(--operator-surface-subtle)] p-3">
        {form}
        {deleteAction && <DeleteTravelerActivityButton action={deleteAction} />}
      </div>
    </details>
  );
}

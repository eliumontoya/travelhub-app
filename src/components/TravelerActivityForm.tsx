"use client";

import { useActionState, type KeyboardEvent } from "react";
import type { Item } from "@/types";
import {
  createTravelerActivityAction,
  deleteTravelerActivityAction,
  type TravelerActivityActionState,
  updateTravelerActivityAction,
} from "@/app/t/[slug]/actions";

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
      className={`text-sm ${state.status === "error" ? "text-red-700 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"}`}
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
        className="min-h-10 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/30"
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
      <label className="grid gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
        Actividad
        <input
          name="title"
          defaultValue={item?.title}
          maxLength={120}
          required
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-950"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
        Hora <span className="font-normal text-gray-500">(opcional)</span>
        <input
          type="time"
          name="startTime"
          defaultValue={item?.startTime ?? ""}
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-950"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200">
        Lugar <span className="font-normal text-gray-500">(opcional)</span>
        <input
          name="location"
          defaultValue={item?.location ?? ""}
          maxLength={200}
          autoComplete="off"
          className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-950"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium text-gray-800 dark:text-gray-200 sm:col-span-2">
        Notas <span className="font-normal text-gray-500">(opcional)</span>
        <textarea
          name="notes"
          defaultValue={item?.notes ?? ""}
          maxLength={2000}
          rows={3}
          onKeyDown={submitOnShortcut}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 outline-none placeholder:text-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-950"
        />
      </label>
    </>
  );

  const form = (
    <form action={formAction} className="grid gap-3 sm:grid-cols-2">
      {fields}
      <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Guardando…" : isEditing ? "Guardar cambios" : "Agregar actividad"}
        </button>
        <ActionFeedback state={state} />
      </div>
    </form>
  );

  if (!isEditing) {
    return (
      <section className="mt-5 border-t border-gray-100 pt-4 print:hidden dark:border-gray-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Agregar una actividad</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">Completá los datos y usá Ctrl o ⌘ + Enter en las notas para guardar.</p>
        <div className="mt-4">{form}</div>
      </section>
    );
  }

  return (
    <details className="print:hidden">
      <summary className="min-h-10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-blue-300 dark:hover:bg-blue-950/30">
        Editar actividad
      </summary>
      <div className="mt-3 space-y-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
        {form}
        {deleteAction && <DeleteTravelerActivityButton action={deleteAction} />}
      </div>
    </details>
  );
}

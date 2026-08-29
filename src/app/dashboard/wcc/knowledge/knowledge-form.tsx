"use client";

import { useActionState } from "react";
import type { WhatsAppKnowledgeEntry, WhatsAppKnowledgeStatus } from "@/types";
import type { WccKnowledgeMutationResult } from "@/lib/wcc-knowledge";

const initialState: WccKnowledgeMutationResult = { ok: false, message: "" };
const knowledgeStatuses: WhatsAppKnowledgeStatus[] = ["draft", "approved", "archived"];

type KnowledgeFormProps = {
  entry?: WhatsAppKnowledgeEntry;
  action: (state: WccKnowledgeMutationResult, formData: FormData) => Promise<WccKnowledgeMutationResult>;
  submitLabel: string;
};

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-medium text-rose-300">{message}</p>;
}

export function KnowledgeForm({ entry, action, submitLabel }: KnowledgeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const selectedStatus: WhatsAppKnowledgeStatus = entry?.status ?? "draft";

  return (
    <form action={formAction} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-200">
          Tema
          <input name="topic" defaultValue={entry?.topic ?? ""} maxLength={120} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" />
          <FieldError message={state.errors?.topic} />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Estado
          <select name="status" defaultValue={selectedStatus} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400">
            {knowledgeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <FieldError message={state.errors?.status} />
        </label>
      </div>
      <label className="mt-4 block text-sm font-medium text-slate-200">
        Pregunta / situación
        <textarea name="question" defaultValue={entry?.question ?? ""} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" />
        <FieldError message={state.errors?.question} />
      </label>
      <label className="mt-4 block text-sm font-medium text-slate-200">
        Respuesta aprobable
        <textarea name="answer" defaultValue={entry?.answer ?? ""} maxLength={4000} rows={7} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" />
        <FieldError message={state.errors?.answer} />
      </label>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-200">
          Tags
          <input name="tags" defaultValue={entry?.tags.join(", ") ?? ""} placeholder="visa, documentos, europa" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" />
          <FieldError message={state.errors?.tags} />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Fuente
          <input name="source" defaultValue={entry?.source ?? ""} maxLength={300} placeholder="Política interna, URL, nota" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-white outline-none focus:border-emerald-400" />
          <FieldError message={state.errors?.source} />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Guardando..." : submitLabel}
        </button>
        {state.message && <p className={state.ok ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>{state.message}</p>}
      </div>
    </form>
  );
}

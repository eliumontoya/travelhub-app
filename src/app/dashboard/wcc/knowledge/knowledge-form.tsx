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
  return <p className="mt-1 text-xs font-medium text-[var(--operator-coral)]">{message}</p>;
}

export function KnowledgeForm({ entry, action, submitLabel }: KnowledgeFormProps) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const selectedStatus: WhatsAppKnowledgeStatus = entry?.status ?? "draft";

  return (
    <form action={formAction} className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-[var(--operator-brand)]">
          Tema
          <input name="topic" defaultValue={entry?.topic ?? ""} maxLength={120} className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-[var(--operator-brand)] outline-none focus:border-[var(--operator-gold)]" />
          <FieldError message={state.errors?.topic} />
        </label>
        <label className="block text-sm font-medium text-[var(--operator-brand)]">
          Estado
          <select name="status" defaultValue={selectedStatus} className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-[var(--operator-brand)] outline-none focus:border-[var(--operator-gold)]">
            {knowledgeStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <FieldError message={state.errors?.status} />
        </label>
      </div>
      <label className="mt-4 block text-sm font-medium text-[var(--operator-brand)]">
        Pregunta / situación
        <textarea name="question" defaultValue={entry?.question ?? ""} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-[var(--operator-brand)] outline-none focus:border-[var(--operator-gold)]" />
        <FieldError message={state.errors?.question} />
      </label>
      <label className="mt-4 block text-sm font-medium text-[var(--operator-brand)]">
        Respuesta aprobable
        <textarea name="answer" defaultValue={entry?.answer ?? ""} maxLength={4000} rows={7} className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-[var(--operator-brand)] outline-none focus:border-[var(--operator-gold)]" />
        <FieldError message={state.errors?.answer} />
      </label>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block text-sm font-medium text-[var(--operator-brand)]">
          Tags
          <input name="tags" defaultValue={entry?.tags.join(", ") ?? ""} placeholder="visa, documentos, europa" className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-[var(--operator-brand)] outline-none focus:border-[var(--operator-gold)]" />
          <FieldError message={state.errors?.tags} />
        </label>
        <label className="block text-sm font-medium text-[var(--operator-brand)]">
          Fuente
          <input name="source" defaultValue={entry?.source ?? ""} maxLength={300} placeholder="Política interna, URL, nota" className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-[var(--operator-brand)] outline-none focus:border-[var(--operator-gold)]" />
          <FieldError message={state.errors?.source} />
        </label>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button disabled={pending} className="rounded-xl bg-[var(--operator-gold)] px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:bg-[var(--operator-accent-strong)] disabled:cursor-not-allowed disabled:opacity-60">
          {pending ? "Guardando..." : submitLabel}
        </button>
        {state.message && <p className={state.ok ? "text-sm text-[var(--operator-gold)]" : "text-sm text-[var(--operator-coral)]"}>{state.message}</p>}
      </div>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import type { WhatsAppKnowledgeStatus } from "@/types";
import type { WccKnowledgeMutationResult } from "@/lib/wcc-knowledge";
import { updateKnowledgeStatusAction } from "./actions";

const initialState: WccKnowledgeMutationResult = { ok: false, message: "" };
const statuses: WhatsAppKnowledgeStatus[] = ["draft", "approved", "archived"];

export function KnowledgeStatusForm({ entryId, currentStatus }: { entryId: string; currentStatus: WhatsAppKnowledgeStatus }) {
  const [state, formAction, pending] = useActionState(updateKnowledgeStatusAction.bind(null, entryId), initialState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select name="status" defaultValue={currentStatus} className="rounded-lg border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-2 py-1.5 text-xs font-medium text-[var(--operator-ink)]">
        {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
      <button disabled={pending} className="rounded-lg border border-[var(--operator-brand)] px-3 py-1.5 text-xs font-semibold text-[var(--operator-gold)] hover:bg-[var(--operator-surface-subtle)] disabled:opacity-60">
        Cambiar
      </button>
      {state.message && <span className={state.ok ? "text-xs text-[var(--operator-gold)]" : "text-xs text-[var(--operator-coral)]"}>{state.message}</span>}
    </form>
  );
}

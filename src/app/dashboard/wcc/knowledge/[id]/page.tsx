import Link from "next/link";
import { getWccKnowledgeEntry } from "@/lib/wcc-knowledge";
import { updateKnowledgeAction } from "../actions";
import { KnowledgeForm } from "../knowledge-form";
import { KnowledgeStatusForm } from "../status-form";
import { formatRelativeTime } from "@/lib/item-meta";

export default async function WccKnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getWccKnowledgeEntry(id);
  const entry = detail.entry;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <Link href="/dashboard/wcc/knowledge" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← Volver a knowledge</Link>
      <section className="mt-5 rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Editar knowledge</p>
        <h2 className="mt-2 text-3xl font-bold text-white">{entry?.topic ?? "Entrada no disponible"}</h2>
        <p className="mt-3 text-sm text-slate-300">Ajusta la respuesta y su estado. Las entradas archived o draft no alimentan respuestas automáticas.</p>
      </section>

      {detail.isConfiguredButUnavailable && <p className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">Supabase está configurado, pero no se pudo leer esta entrada.</p>}
      {!detail.isSupabaseConfigured && <p className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">Modo local/mock: configura Supabase para editar knowledge real.</p>}
      {detail.isSupabaseConfigured && !detail.isConfiguredButUnavailable && !entry && <p className="mt-6 rounded-2xl border border-dashed border-slate-700 bg-slate-900 p-6 text-sm text-slate-400">No encontramos esta entrada.</p>}

      {entry && (
        <>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-300">
            <p>Estado actual: <span className="font-semibold text-white">{entry.status}</span></p>
            <p className="mt-1">Actualizado: {formatRelativeTime(entry.updatedAt)}</p>
            <p className="mt-1">Aprobado: {entry.approvedAt ? formatRelativeTime(entry.approvedAt) : "no aprobado"}</p>
            <div className="mt-4"><KnowledgeStatusForm entryId={entry.id} currentStatus={entry.status} /></div>
          </div>
          <div className="mt-6">
            <KnowledgeForm entry={entry} action={updateKnowledgeAction.bind(null, entry.id)} submitLabel="Guardar cambios" />
          </div>
        </>
      )}
    </main>
  );
}

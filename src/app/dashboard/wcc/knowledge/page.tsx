import Link from "next/link";
import { createKnowledgeAction } from "./actions";
import { KnowledgeForm } from "./knowledge-form";
import { KnowledgeStatusForm } from "./status-form";
import { getWccKnowledgeList, wccKnowledgeStatuses } from "@/lib/wcc-knowledge";
import { formatRelativeTime } from "@/lib/item-meta";
import { WccEmptyState, WccNotice } from "../components";
import type { WhatsAppKnowledgeStatus } from "@/types";

function statusClasses(status: WhatsAppKnowledgeStatus) {
  if (status === "approved") return "border-emerald-400/40 bg-emerald-400/10 text-emerald-200";
  if (status === "archived") return "border-slate-600 bg-slate-800 text-slate-300";
  return "border-amber-400/40 bg-amber-400/10 text-amber-200";
}

function pageHref(page: number, status?: string) {
  const params = new URLSearchParams();
  if (page > 1) params.set("page", String(page));
  if (status) params.set("status", status);
  const query = params.toString();
  return `/dashboard/wcc/knowledge${query ? `?${query}` : ""}`;
}

export default async function WccKnowledgePage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const params = await searchParams;
  const list = await getWccKnowledgeList({ page: params.page, status: params.status });
  const unavailable = list.isConfiguredButUnavailable;
  const mockMode = !list.isSupabaseConfigured;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Knowledge base</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Respuestas controladas para WhatsApp</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          Crea, aprueba y archiva conocimiento estático. Solo las entradas approved pueden ser usadas por el agente inbound.
        </p>
      </section>

      {(mockMode || unavailable) && (
        <WccNotice tone={unavailable ? "warning" : "safe"}>
          {unavailable ? "Supabase está configurado, pero WCC no pudo leer knowledge. Las mutaciones mostrarán error seguro." : "Modo local/mock: configura Supabase para crear o editar knowledge real."}
        </WccNotice>
      )}

      <section className="mt-6">
        <h3 className="text-lg font-semibold text-white">Crear knowledge</h3>
        <div className="mt-3">
          <KnowledgeForm action={createKnowledgeAction} submitLabel="Crear knowledge" />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Entradas</h3>
            <p className="mt-1 text-sm text-slate-400">{list.totalCount} entrada(s) encontradas</p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/dashboard/wcc/knowledge" className={!list.status ? "rounded-full bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950" : "rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-emerald-400"}>Todas</Link>
            {wccKnowledgeStatuses.map((status) => (
              <Link key={status} href={pageHref(1, status)} className={list.status === status ? "rounded-full bg-emerald-400 px-3 py-1.5 font-semibold text-slate-950" : "rounded-full border border-slate-700 px-3 py-1.5 text-slate-300 hover:border-emerald-400"}>{status}</Link>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {list.entries.length ? list.entries.map((entry) => (
            <article key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses(entry.status)}`}>{entry.status}</span>
                    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">{entry.topic}</p>
                  </div>
                  <h4 className="mt-3 text-lg font-semibold text-white">{entry.question}</h4>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{entry.answer}</p>
                </div>
                <Link href={`/dashboard/wcc/knowledge/${entry.id}`} className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-100 hover:border-emerald-400 hover:text-emerald-200">Editar</Link>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.tags.map((tag) => <span key={tag} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">#{tag}</span>)}
                {entry.source && <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-400">Fuente: {entry.source}</span>}
              </div>
              <div className="mt-4 grid gap-3 text-xs text-slate-500 md:grid-cols-3">
                <span>Actualizado: {formatRelativeTime(entry.updatedAt)}</span>
                <span>Aprobado: {entry.approvedAt ? formatRelativeTime(entry.approvedAt) : "no aprobado"}</span>
                <KnowledgeStatusForm entryId={entry.id} currentStatus={entry.status} />
              </div>
            </article>
          )) : (
            <WccEmptyState title="Sin knowledge para este filtro" description="Crea una entrada nueva o cambia el filtro. Solo las entradas approved alimentan al agente inbound." actionHref="/dashboard/wcc/knowledge" actionLabel="Ver todas" />
          )}
        </div>

        {list.totalPages > 1 && (
          <div className="mt-6 flex flex-col gap-3 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <Link aria-disabled={list.page <= 1} href={pageHref(Math.max(1, list.page - 1), list.status)} className="rounded-xl border border-slate-700 px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40">Anterior</Link>
            <span>Página {list.page} de {list.totalPages}</span>
            <Link aria-disabled={list.page >= list.totalPages} href={pageHref(Math.min(list.totalPages, list.page + 1), list.status)} className="rounded-xl border border-slate-700 px-3 py-2 aria-disabled:pointer-events-none aria-disabled:opacity-40">Siguiente</Link>
          </div>
        )}
      </section>
    </main>
  );
}

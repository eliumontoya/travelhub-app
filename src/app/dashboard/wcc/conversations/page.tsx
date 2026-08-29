import Link from "next/link";
import { getWccConversationsList, type WccConversationMessage, type WccConversationRow } from "@/lib/wcc-conversations";
import { formatRelativeTime } from "@/lib/item-meta";
import { WccEmptyState, WccNotice } from "../components";

function contactLabel(conversation: WccConversationRow) {
  return conversation.contact?.displayName ?? conversation.contact?.whatsappProfileName ?? conversation.contact?.phoneE164 ?? "Contacto no disponible";
}

function snippet(message?: WccConversationMessage) {
  if (!message) return "Sin registro";
  return message.body ?? `[${message.messageType}] ${message.status}`;
}

export default async function WccConversationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const list = await getWccConversationsList({ page: params.page });
  const hasPrevious = list.page > 1;
  const hasNext = list.totalPages > list.page;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Conversaciones WhatsApp</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Historial agrupado por hilo</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Vista operativa solo lectura. Los mensajes aparecen como contexto dentro de su conversación, no como bandeja raw.</p>
        </div>
        <Link href="/dashboard/wcc" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-200">← Dashboard WCC</Link>
      </div>

      {(!list.isSupabaseConfigured || list.isConfiguredButUnavailable) && (
        <WccNotice tone={list.isConfiguredButUnavailable ? "warning" : "safe"}>
          {list.isConfiguredButUnavailable ? "WCC no pudo leer conversaciones WhatsApp. Se muestra estado seguro sin romper la operación." : "Modo local/mock: configura Supabase para ver conversaciones reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="hidden grid-cols-6 gap-4 border-b border-slate-800 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid">
          <span className="col-span-2">Conversación</span>
          <span>Estado</span>
          <span>Último intent</span>
          <span>Última entrada/salida</span>
          <span>Actividad</span>
        </div>
        {list.conversations.length ? (
          <ul className="divide-y divide-slate-800">
            {list.conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link href={`/dashboard/wcc/conversations/${conversation.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm transition hover:bg-slate-800/70 sm:grid-cols-6 sm:gap-4">
                  <span className="sm:col-span-2">
                    <span className="block font-semibold text-white">{contactLabel(conversation)}</span>
                    <span className="text-slate-500">{conversation.contact?.phoneE164 ?? conversation.id}</span>
                  </span>
                  <span className="text-slate-300">{conversation.status}</span>
                  <span className="text-slate-300">{conversation.latestIntent?.intentType ?? conversation.lastIntent ?? "sin intent"}</span>
                  <span className="space-y-1 text-slate-400">
                    <span className="block">↘ {snippet(conversation.latestInbound)}</span>
                    <span className="block">↗ {snippet(conversation.latestOutbound)}</span>
                  </span>
                  <span className="text-slate-400">{conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "sin mensajes"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><WccEmptyState title="Sin conversaciones WhatsApp" description="Cuando existan mensajes agrupados por hilo, podrás abrir cada conversación y revisar su timeline." actionHref="/dashboard/wcc" actionLabel="Ver dashboard WCC" /></div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{list.totalCount ? `Página ${list.page} de ${list.totalPages} · ${list.totalCount} conversaciones` : "Sin conversaciones"}</span>
        <div className="flex gap-2">
          {hasPrevious ? <Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" href={`/dashboard/wcc/conversations?page=${list.page - 1}`}>Anterior</Link> : <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-600">Anterior</span>}
          {hasNext ? <Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" href={`/dashboard/wcc/conversations?page=${list.page + 1}`}>Siguiente</Link> : <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-600">Siguiente</span>}
        </div>
      </div>
    </main>
  );
}

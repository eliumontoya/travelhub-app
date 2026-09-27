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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--operator-gold)]">Conversaciones WhatsApp</p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--operator-brand)]">Historial agrupado por hilo</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--operator-ink-muted)]">Vista operativa solo lectura. Los mensajes aparecen como contexto dentro de su conversación, no como bandeja raw.</p>
        </div>
        <Link href="/dashboard/wcc" className="rounded-xl border border-[var(--operator-border)] px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:border-[var(--operator-gold)] hover:text-[var(--operator-gold)]">← Dashboard WCC</Link>
      </div>

      {(!list.isSupabaseConfigured || list.isConfiguredButUnavailable) && (
        <WccNotice tone={list.isConfiguredButUnavailable ? "warning" : "safe"}>
          {list.isConfiguredButUnavailable ? "WCC no pudo leer conversaciones WhatsApp. Se muestra estado seguro sin romper la operación." : "Modo local/mock: configura Supabase para ver conversaciones reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-white/94">
        <div className="hidden grid-cols-6 gap-4 border-b border-[var(--operator-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--operator-ink-subtle)] sm:grid">
          <span className="col-span-2">Conversación</span>
          <span>Estado</span>
          <span>Último intent</span>
          <span>Última entrada/salida</span>
          <span>Actividad</span>
        </div>
        {list.conversations.length ? (
          <ul className="divide-y divide-[var(--operator-border)]">
            {list.conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link href={`/dashboard/wcc/conversations/${conversation.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm transition hover:bg-[var(--operator-surface-subtle)]/70 sm:grid-cols-6 sm:gap-4">
                  <span className="sm:col-span-2">
                    <span className="block font-semibold text-[var(--operator-brand)]">{contactLabel(conversation)}</span>
                    <span className="text-[var(--operator-ink-subtle)]">{conversation.contact?.phoneE164 ?? conversation.id}</span>
                  </span>
                  <span className="text-[var(--operator-ink-muted)]">{conversation.status}</span>
                  <span className="text-[var(--operator-ink-muted)]">{conversation.latestIntent?.intentType ?? conversation.lastIntent ?? "sin intent"}</span>
                  <span className="space-y-1 text-[var(--operator-ink-muted)]">
                    <span className="block">↘ {snippet(conversation.latestInbound)}</span>
                    <span className="block">↗ {snippet(conversation.latestOutbound)}</span>
                  </span>
                  <span className="text-[var(--operator-ink-muted)]">{conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "sin mensajes"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><WccEmptyState title="Sin conversaciones WhatsApp" description="Cuando existan mensajes agrupados por hilo, podrás abrir cada conversación y revisar su timeline." actionHref="/dashboard/wcc" actionLabel="Ver dashboard WCC" /></div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 text-sm text-[var(--operator-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{list.totalCount ? `Página ${list.page} de ${list.totalPages} · ${list.totalCount} conversaciones` : "Sin conversaciones"}</span>
        <div className="flex gap-2">
          {hasPrevious ? <Link className="rounded-lg border border-[var(--operator-border)] px-3 py-2 hover:border-[var(--operator-brand)]" href={`/dashboard/wcc/conversations?page=${list.page - 1}`}>Anterior</Link> : <span className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-[var(--operator-ink-subtle)]">Anterior</span>}
          {hasNext ? <Link className="rounded-lg border border-[var(--operator-border)] px-3 py-2 hover:border-[var(--operator-brand)]" href={`/dashboard/wcc/conversations?page=${list.page + 1}`}>Siguiente</Link> : <span className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-[var(--operator-ink-subtle)]">Siguiente</span>}
        </div>
      </div>
    </main>
  );
}

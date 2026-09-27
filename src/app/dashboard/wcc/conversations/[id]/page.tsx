import Link from "next/link";
import { getWccConversationDetail, type WccConversationIntent } from "@/lib/wcc-conversations";
import { formatDateTime, formatRelativeTime } from "@/lib/item-meta";
import { WccBackLink, WccEmptyState, WccNotice } from "../../components";

function intentForMessage(intents: WccConversationIntent[], messageId: string) {
  return intents.filter((intent) => intent.messageId === messageId);
}

export default async function WccConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getWccConversationDetail(id);

  if (detail.isConfiguredButUnavailable) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <WccBackLink href="/dashboard/wcc/conversations">Conversaciones</WccBackLink>
        <WccNotice tone="warning">WCC no pudo leer esta conversación. Se muestra estado seguro.</WccNotice>
      </main>
    );
  }

  if (!detail.conversation) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <WccBackLink href="/dashboard/wcc/conversations">Conversaciones</WccBackLink>
        <WccNotice>Conversación no encontrada o Supabase no está configurado.</WccNotice>
      </main>
    );
  }

  const conversation = detail.conversation;
  const contact = conversation.contact;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <WccBackLink href="/dashboard/wcc/conversations">Conversaciones</WccBackLink>

      <section className="mt-4 rounded-3xl border border-white/15 bg-white/94 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--operator-gold)]">Detalle de conversación</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-[var(--operator-brand)]">{contact?.displayName ?? contact?.whatsappProfileName ?? contact?.phoneE164 ?? conversation.id}</h2>
            <p className="mt-2 text-[var(--operator-ink-muted)]">Estado: {conversation.status} · Intent: {conversation.lastIntent ?? "sin intent"}</p>
            {contact ? <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">{contact.phoneE164}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {contact ? <Link href={`/dashboard/wcc/contacts/${contact.id}`} className="rounded-xl border border-[var(--operator-border)] px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:border-[var(--operator-gold)] hover:text-[var(--operator-gold)]">Ver contacto</Link> : null}
            {contact?.linkedClientId ? <Link href={`/dashboard/clients/${contact.linkedClientId}`} className="rounded-xl border border-[var(--operator-border)] px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:border-[var(--operator-gold)] hover:text-[var(--operator-gold)]">Ver cliente</Link> : null}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[var(--operator-surface-subtle)] p-4"><p className="text-xs text-[var(--operator-ink-subtle)]">Creada</p><p className="mt-1 text-sm text-[var(--operator-brand)]">{formatDateTime(conversation.createdAt)}</p></div>
          <div className="rounded-xl bg-[var(--operator-surface-subtle)] p-4"><p className="text-xs text-[var(--operator-ink-subtle)]">Último mensaje</p><p className="mt-1 text-sm text-[var(--operator-brand)]">{conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "sin mensajes"}</p></div>
          <div className="rounded-xl bg-[var(--operator-surface-subtle)] p-4"><p className="text-xs text-[var(--operator-ink-subtle)]">Última entrada</p><p className="mt-1 text-sm text-[var(--operator-brand)]">{conversation.lastInboundAt ? formatRelativeTime(conversation.lastInboundAt) : "sin entrada"}</p></div>
          <div className="rounded-xl bg-[var(--operator-surface-subtle)] p-4"><p className="text-xs text-[var(--operator-ink-subtle)]">Última salida</p><p className="mt-1 text-sm text-[var(--operator-brand)]">{conversation.lastOutboundAt ? formatRelativeTime(conversation.lastOutboundAt) : "sin salida"}</p></div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Timeline de mensajes</h3>
        {detail.messages.length ? (
          <ol className="mt-4 space-y-4">
            {detail.messages.map((message) => {
              const intents = intentForMessage(detail.intents, message.id);
              return (
                <li key={message.id} className="rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] p-4 text-sm text-[var(--operator-ink-muted)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={message.direction === "inbound" ? "rounded-full bg-[var(--operator-surface-subtle)] px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--operator-gold)]" : "rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--operator-brand)]"}>{message.direction}</span>
                    <span className="rounded-full border border-[var(--operator-border)] px-2.5 py-1 text-xs text-[var(--operator-ink-muted)]">{message.status}</span>
                    <span className="text-xs text-[var(--operator-ink-subtle)]">{formatDateTime(message.occurredAt)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-[var(--operator-brand)]">{message.body ?? `[${message.messageType}]`}</p>
                  {message.processedAt ? <p className="mt-2 text-xs text-[var(--operator-ink-subtle)]">Procesado: {formatDateTime(message.processedAt)}</p> : null}
                  {intents.length ? (
                    <div className="mt-3 space-y-2">
                      {intents.map((intent) => (
                        <p key={intent.id} className="rounded-xl bg-white/94 p-3 text-xs text-[var(--operator-ink-muted)]">Intent: <span className="font-semibold text-[var(--operator-gold)]">{intent.intentType}</span> · {intent.status} · Confianza {intent.confidence ?? "n/a"}{intent.summary ? ` · ${intent.summary}` : ""}</p>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : <WccEmptyState title="Sin mensajes" description="No hay mensajes relacionados con esta conversación todavía." />}
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Intents relacionados</h3>
        {detail.intents.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.intents.map((intent) => (
              <div key={intent.id} className="rounded-xl bg-[var(--operator-surface-subtle)] p-4 text-sm text-[var(--operator-ink-muted)]">
                <p className="font-semibold text-[var(--operator-brand)]">{intent.intentType} · {intent.status}</p>
                <p className="mt-1">{intent.summary ?? "Sin resumen"}</p>
                <p className="mt-1 text-xs text-[var(--operator-ink-subtle)]">Confianza: {intent.confidence ?? "n/a"} · {formatDateTime(intent.detectedAt)}</p>
              </div>
            ))}
          </div>
        ) : <WccEmptyState title="Sin intents" description="Los intents detectados se mostrarán aquí como apoyo de diagnóstico, sin habilitar acciones manuales." />}
      </section>
    </main>
  );
}

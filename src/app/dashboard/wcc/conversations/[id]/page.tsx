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

      <section className="mt-4 rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Detalle de conversación</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">{contact?.displayName ?? contact?.whatsappProfileName ?? contact?.phoneE164 ?? conversation.id}</h2>
            <p className="mt-2 text-slate-300">Estado: {conversation.status} · Intent: {conversation.lastIntent ?? "sin intent"}</p>
            {contact ? <p className="mt-1 text-sm text-slate-400">{contact.phoneE164}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {contact ? <Link href={`/dashboard/wcc/contacts/${contact.id}`} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-200">Ver contacto</Link> : null}
            {contact?.linkedClientId ? <Link href={`/dashboard/clients/${contact.linkedClientId}`} className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-200">Ver cliente</Link> : null}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Creada</p><p className="mt-1 text-sm text-white">{formatDateTime(conversation.createdAt)}</p></div>
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Último mensaje</p><p className="mt-1 text-sm text-white">{conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "sin mensajes"}</p></div>
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Última entrada</p><p className="mt-1 text-sm text-white">{conversation.lastInboundAt ? formatRelativeTime(conversation.lastInboundAt) : "sin entrada"}</p></div>
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Última salida</p><p className="mt-1 text-sm text-white">{conversation.lastOutboundAt ? formatRelativeTime(conversation.lastOutboundAt) : "sin salida"}</p></div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-lg font-semibold text-white">Timeline de mensajes</h3>
        {detail.messages.length ? (
          <ol className="mt-4 space-y-4">
            {detail.messages.map((message) => {
              const intents = intentForMessage(detail.intents, message.id);
              return (
                <li key={message.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={message.direction === "inbound" ? "rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200" : "rounded-full bg-sky-500/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-sky-200"}>{message.direction}</span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-xs text-slate-300">{message.status}</span>
                    <span className="text-xs text-slate-500">{formatDateTime(message.occurredAt)}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-white">{message.body ?? `[${message.messageType}]`}</p>
                  {message.processedAt ? <p className="mt-2 text-xs text-slate-500">Procesado: {formatDateTime(message.processedAt)}</p> : null}
                  {intents.length ? (
                    <div className="mt-3 space-y-2">
                      {intents.map((intent) => (
                        <p key={intent.id} className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">Intent: <span className="font-semibold text-emerald-300">{intent.intentType}</span> · {intent.status} · Confianza {intent.confidence ?? "n/a"}{intent.summary ? ` · ${intent.summary}` : ""}</p>
                      ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        ) : <WccEmptyState title="Sin mensajes" description="No hay mensajes relacionados con esta conversación todavía." />}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-lg font-semibold text-white">Intents relacionados</h3>
        {detail.intents.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {detail.intents.map((intent) => (
              <div key={intent.id} className="rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">{intent.intentType} · {intent.status}</p>
                <p className="mt-1">{intent.summary ?? "Sin resumen"}</p>
                <p className="mt-1 text-xs text-slate-500">Confianza: {intent.confidence ?? "n/a"} · {formatDateTime(intent.detectedAt)}</p>
              </div>
            ))}
          </div>
        ) : <WccEmptyState title="Sin intents" description="Los intents detectados se mostrarán aquí como apoyo de diagnóstico, sin habilitar acciones manuales." />}
      </section>
    </main>
  );
}

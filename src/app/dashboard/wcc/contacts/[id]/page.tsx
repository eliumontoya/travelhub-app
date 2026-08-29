import Link from "next/link";
import { getWccContactDetail } from "@/lib/wcc-contacts";
import { formatDateTime, formatRelativeTime } from "@/lib/item-meta";
import { WccBackLink, WccEmptyState, WccInlineLink, WccNotice } from "../../components";

export default async function WccContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getWccContactDetail(id);

  if (detail.isConfiguredButUnavailable) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <WccBackLink href="/dashboard/wcc/contacts">Contactos</WccBackLink>
        <WccNotice tone="warning">WCC no pudo leer esta ficha de contacto. Se muestra estado seguro.</WccNotice>
      </main>
    );
  }

  if (!detail.contact) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <WccBackLink href="/dashboard/wcc/contacts">Contactos</WccBackLink>
        <WccNotice>Contacto no encontrado o Supabase no está configurado.</WccNotice>
      </main>
    );
  }

  const contact = detail.contact;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <WccBackLink href="/dashboard/wcc/contacts">Contactos</WccBackLink>

      <section className="mt-4 rounded-3xl border border-emerald-400/20 bg-slate-900 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Ficha WhatsApp</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold text-white">{contact.displayName ?? contact.phoneE164}</h2>
            <p className="mt-2 text-slate-300">{contact.phoneE164}</p>
            {contact.whatsappProfileName ? <p className="mt-1 text-sm text-slate-400">Perfil WhatsApp: {contact.whatsappProfileName}</p> : null}
          </div>
          <span className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300">Opt-in: {contact.optInStatus}</span>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Primer contacto</p><p className="mt-1 text-sm text-white">{formatDateTime(contact.firstSeenAt)}</p></div>
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Última vista</p><p className="mt-1 text-sm text-white">{formatDateTime(contact.lastSeenAt)}</p></div>
          <div className="rounded-xl bg-slate-950 p-4"><p className="text-xs text-slate-500">Último mensaje</p><p className="mt-1 text-sm text-white">{contact.lastMessageAt ? formatRelativeTime(contact.lastMessageAt) : "sin mensajes"}</p></div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-lg font-semibold text-white">Cliente TravelHub vinculado</h3>
        {contact.linkedClient ? (
          <div className="mt-4 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
            <WccInlineLink href={`/dashboard/clients/${contact.linkedClient.id}`}>{contact.linkedClient.name}</WccInlineLink>
            <p className="mt-1">{contact.linkedClient.email || "sin email"} · {contact.linkedClient.whatsapp || contact.linkedClient.phone || "sin teléfono"}</p>
          </div>
        ) : <WccEmptyState title="Sin cliente vinculado" description="Este contacto aún no está vinculado a un cliente TravelHub. La vista se mantiene en solo lectura para preservar el alcance WCC v1." />}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Conversaciones</h3>
          {detail.conversations.length ? detail.conversations.map((item) => (
            <Link key={item.id} href={`/dashboard/wcc/conversations/${item.id}`} className="mt-3 block rounded-xl bg-slate-950 p-4 text-sm text-slate-300 transition hover:bg-slate-800">
              <p className="font-semibold text-white">{item.status}</p>
              <p className="mt-1">Intent: {item.lastIntent ?? "sin intent"}</p>
              <p className="mt-1 text-slate-500">{item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "sin fecha"}</p>
            </Link>
          )) : <WccEmptyState title="Sin conversaciones" description="No hay conversaciones relacionadas con este contacto todavía." actionHref="/dashboard/wcc/conversations" actionLabel="Abrir conversaciones" />}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Escalaciones</h3>
          {detail.escalations.length ? detail.escalations.map((item) => (
            <div key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{item.priority} · {item.status}</p>
              <p className="mt-1">{item.summary ?? item.reason}</p>
              <p className="mt-1 text-slate-500">Abierta: {formatDateTime(item.openedAt)}</p>
            </div>
          )) : <WccEmptyState title="Sin escalaciones" description="No hay escalaciones relacionadas. Si aparece una atención humana pendiente, se listará aquí y en la cola." actionHref="/dashboard/wcc/escalations" actionLabel="Abrir escalaciones" />}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Intents</h3>
          {detail.intents.length ? detail.intents.map((item) => (
            <div key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{item.intentType} · {item.status}</p>
              <p className="mt-1">{item.summary ?? "Sin resumen"}</p>
              <p className="mt-1 text-slate-500">Confianza: {item.confidence ?? "n/a"} · {formatDateTime(item.detectedAt)}</p>
            </div>
          )) : <WccEmptyState title="Sin intents" description="No hay intents relacionados con este contacto todavía." />}
        </div>
      </section>
    </main>
  );
}

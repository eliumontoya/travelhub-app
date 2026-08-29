import Link from "next/link";
import { getWccContactDetail } from "@/lib/wcc-contacts";
import { formatDateTime, formatRelativeTime } from "@/lib/item-meta";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">{children}</p>;
}

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
        <Link href="/dashboard/wcc/contacts" className="text-sm text-emerald-300 hover:underline">← Contactos</Link>
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-300">WCC no pudo leer esta ficha de contacto. Se muestra estado seguro.</div>
      </main>
    );
  }

  if (!detail.contact) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Link href="/dashboard/wcc/contacts" className="text-sm text-emerald-300 hover:underline">← Contactos</Link>
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-6 text-sm text-slate-300">Contacto no encontrado o Supabase no está configurado.</div>
      </main>
    );
  }

  const contact = detail.contact;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/dashboard/wcc/contacts" className="text-sm text-emerald-300 hover:underline">← Contactos</Link>

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
            <Link href={`/dashboard/clients/${contact.linkedClient.id}`} className="font-semibold text-emerald-300 hover:underline">{contact.linkedClient.name}</Link>
            <p className="mt-1">{contact.linkedClient.email || "sin email"} · {contact.linkedClient.whatsapp || contact.linkedClient.phone || "sin teléfono"}</p>
          </div>
        ) : <Empty>Este contacto aún no está vinculado a un cliente TravelHub.</Empty>}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Conversaciones</h3>
          {detail.conversations.length ? detail.conversations.map((item) => (
            <div key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{item.status}</p>
              <p className="mt-1">Intent: {item.lastIntent ?? "sin intent"}</p>
              <p className="mt-1 text-slate-500">{item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "sin fecha"}</p>
            </div>
          )) : <Empty>No hay conversaciones relacionadas.</Empty>}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Escalaciones</h3>
          {detail.escalations.length ? detail.escalations.map((item) => (
            <div key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{item.priority} · {item.status}</p>
              <p className="mt-1">{item.summary ?? item.reason}</p>
              <p className="mt-1 text-slate-500">Abierta: {formatDateTime(item.openedAt)}</p>
            </div>
          )) : <Empty>No hay escalaciones relacionadas.</Empty>}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Intents</h3>
          {detail.intents.length ? detail.intents.map((item) => (
            <div key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">
              <p className="font-semibold text-white">{item.intentType} · {item.status}</p>
              <p className="mt-1">{item.summary ?? "Sin resumen"}</p>
              <p className="mt-1 text-slate-500">Confianza: {item.confidence ?? "n/a"} · {formatDateTime(item.detectedAt)}</p>
            </div>
          )) : <Empty>No hay intents relacionados.</Empty>}
        </div>
      </section>
    </main>
  );
}

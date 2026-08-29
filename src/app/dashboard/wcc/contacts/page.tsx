import Link from "next/link";
import { getWccContactsList } from "@/lib/wcc-contacts";
import { formatRelativeTime } from "@/lib/item-meta";
import { WccEmptyState, WccNotice } from "../components";

function contactName(contact: { displayName?: string; whatsappProfileName?: string; phoneE164: string }) {
  return contact.displayName ?? contact.whatsappProfileName ?? contact.phoneE164;
}

export default async function WccContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Number(params.page ?? "1");
  const list = await getWccContactsList(currentPage);
  const hasPrevious = list.page > 1;
  const hasNext = list.totalPages > list.page;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Contactos WhatsApp</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Quién escribió por WhatsApp</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Lista operativa solo lectura, ordenada por actividad reciente y enlazada a la ficha de cada contacto.</p>
        </div>
        <Link href="/dashboard/wcc" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-200">← Dashboard WCC</Link>
      </div>

      {(!list.isSupabaseConfigured || list.isConfiguredButUnavailable) && (
        <WccNotice tone={list.isConfiguredButUnavailable ? "warning" : "safe"}>
          {list.isConfiguredButUnavailable ? "WCC no pudo leer contactos WhatsApp. Se muestra estado seguro sin romper la operación." : "Modo local/mock: configura Supabase para ver contactos reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="hidden grid-cols-5 gap-4 border-b border-slate-800 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid">
          <span className="col-span-2">Contacto</span>
          <span>Cliente vinculado</span>
          <span>Opt-in</span>
          <span>Última actividad</span>
        </div>
        {list.contacts.length ? (
          <ul className="divide-y divide-slate-800">
            {list.contacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/dashboard/wcc/contacts/${contact.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm transition hover:bg-slate-800/70 sm:grid-cols-5 sm:gap-4">
                  <span className="sm:col-span-2">
                    <span className="block font-semibold text-white">{contactName(contact)}</span>
                    <span className="text-slate-400">{contact.phoneE164}</span>
                  </span>
                  <span className="text-slate-300">{contact.linkedClient ? contact.linkedClient.name : "Sin vincular"}</span>
                  <span className="text-slate-300">{contact.optInStatus}</span>
                  <span className="text-slate-400">{contact.lastMessageAt ? formatRelativeTime(contact.lastMessageAt) : "sin mensajes"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><WccEmptyState title="Sin contactos WhatsApp" description="Cuando el webhook registre mensajes entrantes, los contactos aparecerán aquí ordenados por actividad reciente." actionHref="/dashboard/wcc" actionLabel="Ver dashboard WCC" /></div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{list.totalCount ? `Página ${list.page} de ${list.totalPages} · ${list.totalCount} contactos` : "Sin contactos"}</span>
        <div className="flex gap-2">
          {hasPrevious ? <Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" href={`/dashboard/wcc/contacts?page=${list.page - 1}`}>Anterior</Link> : <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-600">Anterior</span>}
          {hasNext ? <Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" href={`/dashboard/wcc/contacts?page=${list.page + 1}`}>Siguiente</Link> : <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-600">Siguiente</span>}
        </div>
      </div>
    </main>
  );
}

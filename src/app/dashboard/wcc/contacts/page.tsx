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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--operator-gold)]">Contactos WhatsApp</p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--operator-brand)]">Quién escribió por WhatsApp</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--operator-ink-muted)]">Lista operativa solo lectura, ordenada por actividad reciente y enlazada a la ficha de cada contacto.</p>
        </div>
        <Link href="/dashboard/wcc" className="rounded-xl border border-[var(--operator-border)] px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:border-[var(--operator-gold)] hover:text-[var(--operator-gold)]">← Dashboard WCC</Link>
      </div>

      {(!list.isSupabaseConfigured || list.isConfiguredButUnavailable) && (
        <WccNotice tone={list.isConfiguredButUnavailable ? "warning" : "safe"}>
          {list.isConfiguredButUnavailable ? "WCC no pudo leer contactos WhatsApp. Se muestra estado seguro sin romper la operación." : "Modo local/mock: configura Supabase para ver contactos reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-white/94">
        <div className="hidden grid-cols-5 gap-4 border-b border-[var(--operator-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--operator-ink-subtle)] sm:grid">
          <span className="col-span-2">Contacto</span>
          <span>Cliente vinculado</span>
          <span>Opt-in</span>
          <span>Última actividad</span>
        </div>
        {list.contacts.length ? (
          <ul className="divide-y divide-[var(--operator-border)]">
            {list.contacts.map((contact) => (
              <li key={contact.id}>
                <Link href={`/dashboard/wcc/contacts/${contact.id}`} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm transition hover:bg-[var(--operator-surface-subtle)]/70 sm:grid-cols-5 sm:gap-4">
                  <span className="sm:col-span-2">
                    <span className="block font-semibold text-[var(--operator-brand)]">{contactName(contact)}</span>
                    <span className="text-[var(--operator-ink-muted)]">{contact.phoneE164}</span>
                  </span>
                  <span className="text-[var(--operator-ink-muted)]">{contact.linkedClient ? contact.linkedClient.name : "Sin vincular"}</span>
                  <span className="text-[var(--operator-ink-muted)]">{contact.optInStatus}</span>
                  <span className="text-[var(--operator-ink-muted)]">{contact.lastMessageAt ? formatRelativeTime(contact.lastMessageAt) : "sin mensajes"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><WccEmptyState title="Sin contactos WhatsApp" description="Cuando el webhook registre mensajes entrantes, los contactos aparecerán aquí ordenados por actividad reciente." actionHref="/dashboard/wcc" actionLabel="Ver dashboard WCC" /></div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 text-sm text-[var(--operator-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{list.totalCount ? `Página ${list.page} de ${list.totalPages} · ${list.totalCount} contactos` : "Sin contactos"}</span>
        <div className="flex gap-2">
          {hasPrevious ? <Link className="rounded-lg border border-[var(--operator-border)] px-3 py-2 hover:border-[var(--operator-brand)]" href={`/dashboard/wcc/contacts?page=${list.page - 1}`}>Anterior</Link> : <span className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-[var(--operator-ink-subtle)]">Anterior</span>}
          {hasNext ? <Link className="rounded-lg border border-[var(--operator-border)] px-3 py-2 hover:border-[var(--operator-brand)]" href={`/dashboard/wcc/contacts?page=${list.page + 1}`}>Siguiente</Link> : <span className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-[var(--operator-ink-subtle)]">Siguiente</span>}
        </div>
      </div>
    </main>
  );
}

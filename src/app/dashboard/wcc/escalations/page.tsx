import Link from "next/link";
import {
  getWccEscalationsQueue,
  wccEscalationPriorities,
  wccEscalationStatuses,
  type WccEscalationRow,
} from "@/lib/wcc-escalations";
import { formatDateTime, formatRelativeTime } from "@/lib/item-meta";
import { WccEmptyState, WccNotice } from "../components";

const priorityStyles: Record<string, string> = {
  urgent: "border-[var(--operator-coral)]/50 bg-[var(--operator-coral)]/10 text-[var(--operator-coral)]",
  high: "border-[var(--operator-gold)]/60 bg-[var(--operator-gold)]/15 text-[var(--operator-brand)]",
  normal: "border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]",
  low: "border-[var(--operator-border)] bg-white/94 text-[var(--operator-ink-muted)]",
};

const statusStyles: Record<string, string> = {
  open: "border-[var(--operator-gold)]/60 bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]",
  acknowledged: "border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]",
  resolved: "border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)]",
  canceled: "border-[var(--operator-border)] bg-white/94 text-[var(--operator-ink-muted)]",
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${className}`}>{children}</span>;
}

function filterHref(next: { status?: string; priority?: string; page?: number }) {
  const params = new URLSearchParams();
  if (next.status) params.set("status", next.status);
  if (next.priority) params.set("priority", next.priority);
  if (next.page && next.page > 1) params.set("page", String(next.page));
  const query = params.toString();
  return `/dashboard/wcc/escalations${query ? `?${query}` : ""}`;
}

function contactLabel(escalation: WccEscalationRow) {
  return escalation.contact?.displayName ?? escalation.contact?.whatsappProfileName ?? escalation.contact?.phoneE164 ?? "Contacto no disponible";
}

function FilterGroup({ label, values, active, param, other }: { label: string; values: string[]; active?: string; param: "status" | "priority"; other: { status?: string; priority?: string } }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--operator-ink-subtle)]">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => {
          const next = { ...other, [param]: active === value ? undefined : value };
          return (
            <Link key={value} href={filterHref(next)} className={active === value ? "rounded-full bg-[var(--operator-gold)] px-3 py-1.5 text-sm font-semibold text-[var(--operator-brand)]" : "rounded-full border border-[var(--operator-border)] px-3 py-1.5 text-sm text-[var(--operator-ink-muted)] hover:border-[var(--operator-brand)] hover:text-[var(--operator-brand)]"}>
              {value}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function WccEscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; priority?: string }>;
}) {
  const params = await searchParams;
  const queue = await getWccEscalationsQueue({ page: Number(params.page ?? "1"), status: params.status, priority: params.priority });
  const hasPrevious = queue.page > 1;
  const hasNext = queue.totalPages > queue.page;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--operator-gold)]">Escalaciones WhatsApp</p>
          <h2 className="mt-2 text-3xl font-bold text-[var(--operator-brand)]">Cola de atención humana</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--operator-ink-muted)]">Bandeja solo lectura, ordenada por las escalaciones más recientes y pensada para distinguir rápido casos abiertos o urgentes.</p>
        </div>
        <Link href="/dashboard/wcc" className="rounded-xl border border-[var(--operator-border)] px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:border-[var(--operator-gold)] hover:text-[var(--operator-gold)]">← Dashboard WCC</Link>
      </div>

      {(!queue.isSupabaseConfigured || queue.isConfiguredButUnavailable) && (
        <WccNotice tone={queue.isConfiguredButUnavailable ? "warning" : "safe"}>
          {queue.isConfiguredButUnavailable ? "WCC no pudo leer escalaciones WhatsApp. Se muestra estado seguro sin romper la operación." : "Modo local/mock: configura Supabase para ver escalaciones reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 grid gap-4 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)] lg:grid-cols-[1fr_1fr_auto]">
        <FilterGroup label="Estado" values={wccEscalationStatuses} active={queue.status} param="status" other={{ priority: queue.priority }} />
        <FilterGroup label="Prioridad" values={wccEscalationPriorities} active={queue.priority} param="priority" other={{ status: queue.status }} />
        <div className="flex items-end">
          <Link href="/dashboard/wcc/escalations" className="rounded-full border border-[var(--operator-border)] px-3 py-1.5 text-sm text-[var(--operator-ink-muted)] hover:border-[var(--operator-brand)] hover:text-[var(--operator-brand)]">Limpiar filtros</Link>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-white/94">
        <div className="hidden grid-cols-6 gap-4 border-b border-[var(--operator-border)] px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--operator-ink-subtle)] sm:grid">
          <span className="col-span-2">Caso</span>
          <span>Contacto</span>
          <span>Prioridad</span>
          <span>Estado</span>
          <span>Abierta</span>
        </div>
        {queue.escalations.length ? (
          <ul className="divide-y divide-[var(--operator-border)]">
            {queue.escalations.map((escalation) => (
              <li key={escalation.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm sm:grid-cols-6 sm:gap-4">
                <div className="sm:col-span-2">
                  <p className="font-semibold text-[var(--operator-brand)]">{escalation.summary ?? escalation.reason}</p>
                  {escalation.summary ? <p className="mt-1 text-[var(--operator-ink-muted)]">{escalation.reason}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--operator-ink-subtle)]">
                    <span>Conversación: {escalation.conversation?.status ?? "sin contexto"}</span>
                    {escalation.conversation?.lastIntent ? <span>Intent: {escalation.conversation.lastIntent}</span> : null}
                    {escalation.conversation ? <Link href={`/dashboard/wcc/conversations/${escalation.conversation.id}`} className="text-[var(--operator-gold)] hover:underline">Ver conversación</Link> : null}
                  </div>
                </div>
                <div>
                  {escalation.contact ? (
                    <Link href={`/dashboard/wcc/contacts/${escalation.contact.id}`} className="font-semibold text-[var(--operator-gold)] hover:underline">{contactLabel(escalation)}</Link>
                  ) : (
                    <span className="text-[var(--operator-ink-muted)]">{contactLabel(escalation)}</span>
                  )}
                  {escalation.contact?.phoneE164 ? <p className="mt-1 text-[var(--operator-ink-subtle)]">{escalation.contact.phoneE164}</p> : null}
                </div>
                <div><Badge className={priorityStyles[escalation.priority]}>{escalation.priority}</Badge></div>
                <div><Badge className={statusStyles[escalation.status]}>{escalation.status}</Badge>{escalation.resolvedAt ? <p className="mt-2 text-xs text-[var(--operator-ink-subtle)]">Resuelta: {formatDateTime(escalation.resolvedAt)}</p> : null}</div>
                <div className="text-[var(--operator-ink-muted)]"><p>{formatRelativeTime(escalation.openedAt)}</p><p className="mt-1 text-xs text-[var(--operator-ink-subtle)]">{formatDateTime(escalation.openedAt)}</p></div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><WccEmptyState title="Sin escalaciones para mostrar" description="No hay casos con estos filtros. Cambia filtros o vuelve al dashboard para revisar otras señales WCC." actionHref="/dashboard/wcc" actionLabel="Ver dashboard WCC" /></div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 text-sm text-[var(--operator-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
        <span>{queue.totalCount ? `Página ${queue.page} de ${queue.totalPages} · ${queue.totalCount} escalaciones` : "Sin escalaciones"}</span>
        <div className="flex gap-2">
          {hasPrevious ? <Link className="rounded-lg border border-[var(--operator-border)] px-3 py-2 hover:border-[var(--operator-brand)]" href={filterHref({ status: queue.status, priority: queue.priority, page: queue.page - 1 })}>Anterior</Link> : <span className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-[var(--operator-ink-subtle)]">Anterior</span>}
          {hasNext ? <Link className="rounded-lg border border-[var(--operator-border)] px-3 py-2 hover:border-[var(--operator-brand)]" href={filterHref({ status: queue.status, priority: queue.priority, page: queue.page + 1 })}>Siguiente</Link> : <span className="rounded-lg border border-[var(--operator-border)] px-3 py-2 text-[var(--operator-ink-subtle)]">Siguiente</span>}
        </div>
      </div>
    </main>
  );
}

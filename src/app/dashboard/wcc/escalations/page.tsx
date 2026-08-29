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
  urgent: "border-red-400/60 bg-red-500/15 text-red-100",
  high: "border-amber-400/60 bg-amber-500/15 text-amber-100",
  normal: "border-slate-600 bg-slate-800 text-slate-200",
  low: "border-slate-700 bg-slate-900 text-slate-300",
};

const statusStyles: Record<string, string> = {
  open: "border-emerald-400/60 bg-emerald-500/15 text-emerald-100",
  acknowledged: "border-sky-400/60 bg-sky-500/15 text-sky-100",
  resolved: "border-slate-600 bg-slate-800 text-slate-300",
  canceled: "border-slate-700 bg-slate-900 text-slate-400",
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
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map((value) => {
          const next = { ...other, [param]: active === value ? undefined : value };
          return (
            <Link key={value} href={filterHref(next)} className={active === value ? "rounded-full bg-emerald-400 px-3 py-1.5 text-sm font-semibold text-slate-950" : "rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-white"}>
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
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Escalaciones WhatsApp</p>
          <h2 className="mt-2 text-3xl font-bold text-white">Cola de atención humana</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Bandeja solo lectura, ordenada por las escalaciones más recientes y pensada para distinguir rápido casos abiertos o urgentes.</p>
        </div>
        <Link href="/dashboard/wcc" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-200">← Dashboard WCC</Link>
      </div>

      {(!queue.isSupabaseConfigured || queue.isConfiguredButUnavailable) && (
        <WccNotice tone={queue.isConfiguredButUnavailable ? "warning" : "safe"}>
          {queue.isConfiguredButUnavailable ? "WCC no pudo leer escalaciones WhatsApp. Se muestra estado seguro sin romper la operación." : "Modo local/mock: configura Supabase para ver escalaciones reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-5 lg:grid-cols-[1fr_1fr_auto]">
        <FilterGroup label="Estado" values={wccEscalationStatuses} active={queue.status} param="status" other={{ priority: queue.priority }} />
        <FilterGroup label="Prioridad" values={wccEscalationPriorities} active={queue.priority} param="priority" other={{ status: queue.status }} />
        <div className="flex items-end">
          <Link href="/dashboard/wcc/escalations" className="rounded-full border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:border-slate-500 hover:text-white">Limpiar filtros</Link>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
        <div className="hidden grid-cols-6 gap-4 border-b border-slate-800 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 sm:grid">
          <span className="col-span-2">Caso</span>
          <span>Contacto</span>
          <span>Prioridad</span>
          <span>Estado</span>
          <span>Abierta</span>
        </div>
        {queue.escalations.length ? (
          <ul className="divide-y divide-slate-800">
            {queue.escalations.map((escalation) => (
              <li key={escalation.id} className="grid grid-cols-1 gap-3 px-5 py-4 text-sm sm:grid-cols-6 sm:gap-4">
                <div className="sm:col-span-2">
                  <p className="font-semibold text-white">{escalation.summary ?? escalation.reason}</p>
                  {escalation.summary ? <p className="mt-1 text-slate-400">{escalation.reason}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Conversación: {escalation.conversation?.status ?? "sin contexto"}</span>
                    {escalation.conversation?.lastIntent ? <span>Intent: {escalation.conversation.lastIntent}</span> : null}
                    {escalation.conversation ? <Link href={`/dashboard/wcc/conversations/${escalation.conversation.id}`} className="text-emerald-300 hover:underline">Ver conversación</Link> : null}
                  </div>
                </div>
                <div>
                  {escalation.contact ? (
                    <Link href={`/dashboard/wcc/contacts/${escalation.contact.id}`} className="font-semibold text-emerald-300 hover:underline">{contactLabel(escalation)}</Link>
                  ) : (
                    <span className="text-slate-400">{contactLabel(escalation)}</span>
                  )}
                  {escalation.contact?.phoneE164 ? <p className="mt-1 text-slate-500">{escalation.contact.phoneE164}</p> : null}
                </div>
                <div><Badge className={priorityStyles[escalation.priority]}>{escalation.priority}</Badge></div>
                <div><Badge className={statusStyles[escalation.status]}>{escalation.status}</Badge>{escalation.resolvedAt ? <p className="mt-2 text-xs text-slate-500">Resuelta: {formatDateTime(escalation.resolvedAt)}</p> : null}</div>
                <div className="text-slate-400"><p>{formatRelativeTime(escalation.openedAt)}</p><p className="mt-1 text-xs text-slate-500">{formatDateTime(escalation.openedAt)}</p></div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-5"><WccEmptyState title="Sin escalaciones para mostrar" description="No hay casos con estos filtros. Cambia filtros o vuelve al dashboard para revisar otras señales WCC." actionHref="/dashboard/wcc" actionLabel="Ver dashboard WCC" /></div>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <span>{queue.totalCount ? `Página ${queue.page} de ${queue.totalPages} · ${queue.totalCount} escalaciones` : "Sin escalaciones"}</span>
        <div className="flex gap-2">
          {hasPrevious ? <Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" href={filterHref({ status: queue.status, priority: queue.priority, page: queue.page - 1 })}>Anterior</Link> : <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-600">Anterior</span>}
          {hasNext ? <Link className="rounded-lg border border-slate-700 px-3 py-2 hover:border-slate-500" href={filterHref({ status: queue.status, priority: queue.priority, page: queue.page + 1 })}>Siguiente</Link> : <span className="rounded-lg border border-slate-800 px-3 py-2 text-slate-600">Siguiente</span>}
        </div>
      </div>
    </main>
  );
}

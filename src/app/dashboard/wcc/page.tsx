import Link from "next/link";
import { getWccDashboardSummary, wccKnowledgeStatuses } from "@/lib/wcc-dashboard";
import { formatRelativeTime } from "@/lib/item-meta";
import { WccEmptyState, WccNotice } from "./components";

export const dynamic = "force-dynamic";

const wccSections = [
  ["contacts", "Contactos", "#240", "Lista y ficha vinculable al CRM.", "/dashboard/wcc/contacts"],
  ["escalations", "Escalaciones", "#241", "Bandeja para casos abiertos o urgentes.", "/dashboard/wcc/escalations"],
  ["conversations", "Conversaciones", "#242", "Hilos agrupados con mensajes e intents.", "/dashboard/wcc/conversations"],
  ["knowledge", "Knowledge", "#243", "CRUD y estados de respuestas aprobadas.", "/dashboard/wcc/knowledge"],
];

function Card({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
      <p className="text-sm text-[var(--operator-ink-muted)]">{label}</p>
      <p className="mt-3 text-3xl font-bold text-[var(--operator-brand)]">{value}</p>
      <p className="mt-2 text-xs text-[var(--operator-ink-subtle)]">{helper}</p>
    </div>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  return <span className="rounded-full bg-[var(--operator-surface-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--operator-ink-muted)]">{type}</span>;
}

export default async function WccDashboardPage() {
  const summary = await getWccDashboardSummary();
  const unavailable = summary.isConfiguredButUnavailable;
  const mockMode = !summary.isSupabaseConfigured;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl border border-white/15 bg-[var(--operator-brand)] p-6 shadow-[var(--operator-shadow-panel)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--operator-gold)]">Operación WhatsApp</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-bold text-white">Centro de mando para mensajes, escalaciones y conocimiento</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-white/80">Shell operativo y señales de salud para el MVP WCC: contactos, escalaciones, conversaciones y knowledge quedan navegables desde un solo lugar.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[var(--operator-brand)] hover:bg-[#fff4ed]">Volver a TravelHub</Link>
          <span className="rounded-xl border border-white/30 px-4 py-2 text-sm text-white/80">PR 6/6 · Polish y QA</span>
        </div>
      </section>

      {(mockMode || unavailable) && (
        <WccNotice tone={unavailable ? "warning" : "safe"}>
          {unavailable ? "Supabase está configurado, pero WCC no pudo leer las tablas WhatsApp. Se muestra estado seguro." : "Modo local/mock: configura Supabase para ver métricas reales de WhatsApp."}
        </WccNotice>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Escalaciones abiertas" value={summary.openEscalations} helper="Atención humana pendiente" />
        <Card label="Conversaciones" value={summary.recentConversationCount} helper="Total disponible" />
        <Card label="Contactos" value={summary.recentContactCount} helper="Capturados por WhatsApp" />
        <Card label="Mensajes pendientes" value={summary.pendingMessageCount} helper="Recibidos/procesados" />
        <Card label="Mensajes fallidos" value={summary.failedMessageCount} helper="Requieren diagnóstico" />
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Observabilidad WhatsApp/IA</h3>
            <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">Métricas operativas sanitizadas del proceso local: webhooks, decisiones, tools, envíos y escalaciones.</p>
          </div>
          <span className="text-xs uppercase tracking-[0.16em] text-[var(--operator-ink-subtle)]">Sin PII ni secretos</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Eventos observados" value={summary.observability.metrics.totalEvents} helper="Ventana reciente en memoria" />
          <Card label="Webhooks" value={summary.observability.metrics.webhookEvents} helper="Admisión y rechazo" />
          <Card label="Duplicados" value={summary.observability.metrics.duplicates} helper="Idempotencia WhatsApp" />
          <Card label="Auto-respuestas" value={summary.observability.metrics.autoAnswers} helper="Decisiones IA seguras" />
          <Card label="Needs human" value={summary.observability.metrics.needsHuman} helper="Derivaciones por decisión" />
          <Card label="Escalaciones" value={summary.observability.metrics.escalations} helper="Casos creados" />
          <Card label="Status callbacks" value={summary.observability.metrics.statusCallbacks} helper="Estados del proveedor" />
          <Card label="Fallos de envío" value={summary.observability.metrics.sendFailures} helper="Cloud API o configuración" />
          <Card label="Fallos IA/tools" value={summary.observability.metrics.aiFailures + summary.observability.metrics.toolFailures} helper="Proveedor o tools" />
        </div>
        <div className="mt-4 rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] p-4">
          <h4 className="text-sm font-semibold text-[var(--operator-brand)]">Fallos recientes sanitizados</h4>
          {summary.observability.recentFailures.length ? (
            <div className="mt-3 space-y-2">
              {summary.observability.recentFailures.slice(0, 5).map((event) => (
                <div key={event.eventId} className="flex flex-col gap-2 rounded-lg bg-white/94 p-3 text-xs text-[var(--operator-ink-muted)] sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <EventTypeBadge type={event.type} />
                    <span>{event.occurredAt}</span>
                  </div>
                  <span className="font-mono text-[var(--operator-ink-subtle)]">{event.correlationId.slice(0, 18)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--operator-ink-subtle)]">Sin fallos observados en la ventana reciente.</p>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Conversaciones recientes</h3>
          {summary.recentConversations.length ? summary.recentConversations.map((item) => (
            <Link key={item.id} href={`/dashboard/wcc/conversations/${item.id}`} className="mt-3 block rounded-xl bg-[var(--operator-surface-subtle)] p-4 text-sm text-[var(--operator-ink-muted)] transition hover:bg-[var(--operator-surface-subtle)]">
              {item.status} · {item.lastIntent ?? "sin intent"} · {item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "sin fecha"}
            </Link>
          )) : <div className="mt-4"><WccEmptyState title="Sin conversaciones recientes" description="Cuando entre actividad por WhatsApp, los hilos recientes aparecerán aquí con acceso directo a su timeline." actionHref="/dashboard/wcc/conversations" actionLabel="Abrir conversaciones" /></div>}
        </div>
        <div className="rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Contactos recientes</h3>
          {summary.recentContacts.length ? summary.recentContacts.map((item) => (
            <Link key={item.id} href={`/dashboard/wcc/contacts/${item.id}`} className="mt-3 block rounded-xl bg-[var(--operator-surface-subtle)] p-4 text-sm text-[var(--operator-ink-muted)] transition hover:bg-[var(--operator-surface-subtle)]">
              {item.displayName ?? item.phoneE164} · {item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "sin fecha"}
            </Link>
          )) : <div className="mt-4"><WccEmptyState title="Sin contactos recientes" description="Los contactos aparecerán cuando entren mensajes nuevos al número de WhatsApp conectado." actionHref="/dashboard/wcc/contacts" actionLabel="Abrir contactos" /></div>}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Knowledge por estado</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {wccKnowledgeStatuses.map((status) => <Card key={status} label={status} value={summary.knowledgeByStatus[status]} helper="Entradas" />)}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {wccSections.map(([id, title, issue, description, href]) => (
          <article id={id} key={id} className="rounded-2xl border border-dashed border-[var(--operator-border)] bg-white/80 p-5">
            <h3 className="font-semibold text-[var(--operator-brand)]">{title} <span className="text-xs text-[var(--operator-ink-muted)]">{issue}</span></h3>
            <p className="mt-3 text-sm text-[var(--operator-ink-muted)]">{description}</p>
            <Link href={href} className="mt-4 inline-flex text-xs font-medium uppercase tracking-[0.16em] text-[var(--operator-gold)] hover:text-[var(--operator-gold)]">Abrir sección</Link>
          </article>
        ))}
      </section>
    </main>
  );
}

import Link from "next/link";
import { getWccDashboardSummary, wccKnowledgeStatuses } from "@/lib/wcc-dashboard";
import { formatRelativeTime } from "@/lib/item-meta";

const nextSections = [
  ["contacts", "Contactos", "#240", "Lista y ficha vinculable al CRM."],
  ["escalations", "Escalaciones", "#241", "Bandeja para casos abiertos o urgentes."],
  ["conversations", "Conversaciones", "#242", "Hilos agrupados con mensajes e intents."],
  ["knowledge", "Knowledge", "#243", "CRUD y estados de respuestas aprobadas."],
];

function Card({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{helper}</p>
    </div>
  );
}

export default async function WccDashboardPage() {
  const summary = await getWccDashboardSummary();
  const unavailable = summary.isConfiguredButUnavailable;
  const mockMode = !summary.isSupabaseConfigured;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <section className="rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-slate-900 to-slate-950 p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">Operación WhatsApp</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-bold text-white">Centro de mando para mensajes, escalaciones y conocimiento</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">Shell operativo y señales de salud. Las bandejas detalladas llegan en los siguientes PRs de la cadena.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-50">Volver a TravelHub</Link>
          <span className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300">PR 1/6 · Shell y dashboard</span>
        </div>
      </section>

      {(mockMode || unavailable) && (
        <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
          {unavailable ? "Supabase está configurado, pero WCC no pudo leer las tablas WhatsApp. Se muestra estado seguro." : "Modo local/mock: configura Supabase para ver métricas reales de WhatsApp."}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card label="Escalaciones abiertas" value={summary.openEscalations} helper="Atención humana pendiente" />
        <Card label="Conversaciones" value={summary.recentConversationCount} helper="Total disponible" />
        <Card label="Contactos" value={summary.recentContactCount} helper="Capturados por WhatsApp" />
        <Card label="Mensajes pendientes" value={summary.pendingMessageCount} helper="Recibidos/procesados" />
        <Card label="Mensajes fallidos" value={summary.failedMessageCount} helper="Requieren diagnóstico" />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Conversaciones recientes</h3>
          {summary.recentConversations.length ? summary.recentConversations.map((item) => (
            <p key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">{item.status} · {item.lastIntent ?? "sin intent"} · {item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "sin fecha"}</p>
          )) : <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Todavía no hay conversaciones.</p>}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
          <h3 className="text-lg font-semibold text-white">Contactos recientes</h3>
          {summary.recentContacts.length ? summary.recentContacts.map((item) => (
            <p key={item.id} className="mt-3 rounded-xl bg-slate-950 p-4 text-sm text-slate-300">{item.displayName ?? item.phoneE164} · {item.lastMessageAt ? formatRelativeTime(item.lastMessageAt) : "sin fecha"}</p>
          )) : <p className="mt-4 rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">Los contactos aparecerán cuando entren mensajes.</p>}
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        <h3 className="text-lg font-semibold text-white">Knowledge por estado</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {wccKnowledgeStatuses.map((status) => <Card key={status} label={status} value={summary.knowledgeByStatus[status]} helper="Entradas" />)}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {nextSections.map(([id, title, issue, description]) => (
          <article id={id} key={id} className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/60 p-5">
            <h3 className="font-semibold text-white">{title} <span className="text-xs text-slate-400">{issue}</span></h3>
            <p className="mt-3 text-sm text-slate-400">{description}</p>
            <p className="mt-4 text-xs font-medium uppercase tracking-[0.16em] text-emerald-300">Placeholder sin CRUD en #239</p>
          </article>
        ))}
      </section>
    </main>
  );
}

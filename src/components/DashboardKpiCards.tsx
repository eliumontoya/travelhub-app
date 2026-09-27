import { TripStats } from "@/lib/data";

function MetricIcon({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`grid h-11 w-11 place-items-center rounded-full ${tone} text-xl font-semibold`} aria-hidden="true">
      {children}
    </span>
  );
}

function KpiCard({ label, value, change, icon, tone }: { label: string; value: number; change: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-[1rem] border border-[var(--operator-border)] bg-white/92 p-5 shadow-[0_16px_32px_rgba(81,0,52,0.06)]">
      <div className="flex items-center gap-4">
        <MetricIcon tone={tone}>{icon}</MetricIcon>
        <div>
          <p className="text-sm font-medium text-[#2d2940]">{label}</p>
          <div className="mt-1 flex items-end gap-3">
            <p className="text-3xl font-extrabold leading-none tracking-[-0.04em] text-[var(--operator-brand)]">{value}</p>
            <span className="text-xs font-semibold text-emerald-600">{change}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardKpiCards({ stats }: { stats: TripStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Viajes activos" value={stats.byStatus.published} change="↑ 3%" icon="▣" tone="bg-[#fff0eb] text-[#ff5848]" />
      <KpiCard label="Cambios hoy" value={stats.upcomingNext7} change="↑ 60%" icon="↻" tone="bg-[#fff0eb] text-[#ff5848]" />
      <KpiCard label="Documentos pendientes" value={stats.unpublishedNearStart} change="↓ 29%" icon="□" tone="bg-[#fff8e8] text-[#ff9a16]" />
      <KpiCard label="Clientes por contactar" value={stats.newClientsThisMonth} change="↓ 18%" icon="⋯" tone="bg-[#fff8e8] text-[#ff9a16]" />
    </div>
  );
}

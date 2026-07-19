import { TripStats } from "@/lib/data";

function KpiCard({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent}`}>{value}</p>
    </div>
  );
}

export default function DashboardKpiCards({ stats }: { stats: TripStats }) {
  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
      <KpiCard label="Borradores" value={stats.byStatus.draft} accent="text-gray-600" />
      <KpiCard label="Publicados" value={stats.byStatus.published} accent="text-green-700" />
      <KpiCard label="Archivados" value={stats.byStatus.archived} accent="text-gray-400" />
      <KpiCard label="Próx. 7 días" value={stats.upcomingNext7} accent="text-blue-700" />
      <KpiCard label="Próx. 30 días" value={stats.upcomingNext30} accent="text-blue-700" />
      <KpiCard label="Clientes nuevos (mes)" value={stats.newClientsThisMonth} accent="text-purple-700" />
      <KpiCard
        label="Sin publicar, viaje cercano"
        value={stats.unpublishedNearStart}
        accent="text-amber-700"
      />
    </div>
  );
}

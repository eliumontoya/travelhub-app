import Link from "next/link";
import {
  getClientReferralSourceCounts,
  getRecentActivity,
  getRecentTripStatusHistory,
  getTripsPerMonth,
  getTripStats,
  getUpcomingBirthdays,
  getUpcomingUnpublishedTrips,
} from "@/lib/data";
import { formatDateShort, formatDateTime, formatRelativeTime } from "@/lib/item-meta";
import DashboardKpiCards from "@/components/DashboardKpiCards";
import { TripsTrendChart } from "@/components/TripsTrendChart";
import { IntegrationsStatusCard } from "@/components/IntegrationsStatusCard";
import { ClientsByReferralSourceCard } from "@/components/ClientsByReferralSourceCard";
import { hasSettingsSavedFlash, type DashboardFlashSearchParams } from "@/lib/dashboard-flash";
import { tripStatusLabel } from "@/lib/data/dashboard";

const activityMeta = {
  trip: { icon: "AV", label: "viaje" },
  client: { icon: "◎", label: "cliente" },
};

const activityActionLabel = {
  created: "creado",
  updated: "editado",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardFlashSearchParams>;
}) {
  const params = await searchParams;
  const showSettingsSaved = hasSettingsSavedFlash(params);
  const [
    stats,
    upcomingUnpublishedTrips,
    recentActivity,
    tripsPerMonth,
    upcomingBirthdays,
    recentStatusHistory,
    referralSourceCounts,
  ] = await Promise.all([
    getTripStats(),
    getUpcomingUnpublishedTrips(),
    getRecentActivity(),
    getTripsPerMonth(),
    getUpcomingBirthdays(),
    getRecentTripStatusHistory(3),
    getClientReferralSourceCounts(),
  ]);

  const primaryTrip = recentStatusHistory[0];
  const secondaryTrip = recentStatusHistory[1];
  const tertiaryTrip = recentStatusHistory[2];

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-7">
      {showSettingsSaved && (
        <div role="status" className="mb-5 rounded-2xl border border-[var(--operator-gold)]/40 bg-[var(--operator-surface-subtle)] p-4 text-sm font-medium text-[var(--operator-brand)]">
          Configuración guardada correctamente.
        </div>
      )}

      {upcomingUnpublishedTrips.length > 0 && (
        <div role="alert" className="mb-5 rounded-2xl border border-[var(--operator-gold)]/50 bg-[var(--operator-gold)]/15 p-4 text-sm text-[var(--operator-brand)]">
          <p className="font-semibold">
            {upcomingUnpublishedTrips.length === 1
              ? "1 viaje empieza en menos de 7 días y sigue en borrador"
              : `${upcomingUnpublishedTrips.length} viajes empiezan en menos de 7 días y siguen en borrador`}
          </p>
          <ul className="mt-2 space-y-1">
            {upcomingUnpublishedTrips.map((trip) => (
              <li key={trip.id}>
                <Link href={`/dashboard/trips/${trip.id}`} className="underline hover:no-underline">
                  {trip.title}
                </Link>{" "}
                · inicia {formatDateShort(trip.startDate)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-[-0.055em] text-[var(--operator-brand)] sm:text-5xl">Buenos días</h1>
          <p className="mt-1 text-sm font-medium text-[var(--operator-ink-muted)]">Martes, 15 de abril de 2025</p>
        </div>
        <Link href="/dashboard/trips/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--operator-brand)] px-6 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(81,0,52,0.23)] transition hover:bg-[var(--operator-brand-strong)]">
          <span aria-hidden="true" className="grid h-5 w-5 place-items-center rounded-full border border-white/80 text-sm">+</span>
          Nuevo viaje
        </Link>
      </section>

      <DashboardKpiCards stats={stats} />

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(21rem,0.85fr)]">
        <section className="rounded-[1rem] border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="text-2xl font-extrabold tracking-[-0.04em] text-[var(--operator-brand)]">Viajes en curso</h2>
            <Link href="/dashboard/trips" className="text-sm font-semibold text-[var(--operator-brand)] hover:underline">Ver todos →</Link>
          </div>

          <Link href={primaryTrip?.href ?? (upcomingUnpublishedTrips[0] ? `/dashboard/trips/${upcomingUnpublishedTrips[0].id}` : "/dashboard/trips")} className="block rounded-[1rem] bg-[#fff0f0] p-5 transition hover:shadow-md">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-4">
                <span aria-hidden="true" className="grid h-12 w-12 place-items-center rounded-full bg-white text-xl text-[var(--operator-brand)] shadow-sm">◎</span>
                <div>
                  <p className="font-bold text-[#22182d]">{primaryTrip?.tripTitle ?? upcomingUnpublishedTrips[0]?.title ?? "Ciudad de México → Oaxaca"}</p>
                  <p className="text-sm text-[var(--operator-ink-muted)]">Operación activa · {primaryTrip ? formatDateTime(primaryTrip.changedAt) : upcomingUnpublishedTrips[0] ? formatDateShort(upcomingUnpublishedTrips[0].startDate) : "12 — 16 de abril, 2025"}</p>
                </div>
              </div>
              <span className="w-fit rounded-full bg-[var(--operator-surface-subtle)] px-4 py-2 text-xs font-bold text-[var(--operator-brand)]">● En curso</span>
            </div>
            <div className="mt-7 grid grid-cols-4 gap-2 text-center text-xs font-bold text-[#2e2540]">
              <div><span className="mx-auto mb-2 block h-7 w-7 rounded-full bg-[var(--operator-coral)] ring-4 ring-white" />CDMX<br /><span className="font-medium text-[var(--operator-ink-muted)]">Completado</span></div>
              <div><span className="mx-auto mb-2 block h-7 w-7 rounded-full border-[7px] border-white bg-[var(--operator-coral)] ring-2 ring-[var(--operator-coral)]" />Oaxaca<br /><span className="font-medium text-[var(--operator-ink-muted)]">En curso</span></div>
              <div><span className="mx-auto mb-2 block h-7 w-7 rounded-full bg-[#d9dce3] ring-4 ring-white" />Monte Albán<br /><span className="font-medium text-[var(--operator-ink-muted)]">Próximo</span></div>
              <div><span className="mx-auto mb-2 block h-7 w-7 rounded-full bg-[#d9dce3] ring-4 ring-white" />Regreso<br /><span className="font-medium text-[var(--operator-ink-muted)]">Próximo</span></div>
            </div>
          </Link>

          <div className="divide-y divide-[var(--operator-border)]">
            {[secondaryTrip, tertiaryTrip].filter(Boolean).map((trip) => (
              <Link key={trip!.id} href={trip!.href} className="flex items-center justify-between gap-4 py-4 text-sm hover:text-[var(--operator-brand)]">
                <span>
                  <strong className="block text-[#23182f]">{trip!.tripTitle}</strong>
                  <span className="text-[var(--operator-ink-muted)]">{tripStatusLabel(trip!.fromStatus)} → {tripStatusLabel(trip!.toStatus)}</span>
                </span>
                <span className="rounded-full bg-[var(--operator-surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--operator-brand)]">● En curso</span>
              </Link>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <section className="rounded-[1rem] border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-[-0.04em] text-[var(--operator-brand)]">Actualizaciones en tiempo real</h2>
              <Link href="/dashboard/trips" className="text-sm font-semibold text-[var(--operator-brand)]">Ver todas ›</Link>
            </div>
            <div className="space-y-4">
              {recentActivity.slice(0, 4).map((event) => (
                <Link key={`${event.entityType}-${event.id}`} href={event.href} className="flex items-start gap-3 text-sm hover:text-[var(--operator-brand)]">
                  <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#fff0eb] text-[var(--operator-coral)]">{activityMeta[event.entityType].icon}</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-[#25192f]">{event.title}</strong>
                    <span className="text-[var(--operator-ink-muted)]">{activityActionLabel[event.action]} · {activityMeta[event.entityType].label}</span>
                  </span>
                  <span className="shrink-0 text-xs text-[var(--operator-ink-subtle)]">{formatRelativeTime(event.timestamp)}</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-[1rem] border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-[-0.04em] text-[var(--operator-brand)]">Documentos del viajero</h2>
              <Link href="/dashboard/trips" className="text-sm font-semibold text-[var(--operator-brand)]">Ver todas ›</Link>
            </div>
            {[
              "Itinerario de viaje",
              "Pase de abordar",
              "Voucher de hotel",
              "Seguro de viaje",
            ].map((name, index) => (
              <div key={name} className="flex items-center gap-3 border-t border-[var(--operator-border)] py-3 text-sm first:border-t-0">
                <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full bg-[#f4e8f2] text-[var(--operator-brand)]">□</span>
                <span className="font-medium text-[#261a31]">{name}</span>
                <span className="ml-auto text-xs text-[var(--operator-ink-muted)]">{index < 3 ? "Completado" : "Pendiente"}</span>
              </div>
            ))}
          </section>
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
        <section className="rounded-[1rem] border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <h2 className="mb-4 text-xl font-extrabold tracking-[-0.04em] text-[var(--operator-brand)]">Actividad reciente</h2>
          {recentActivity.length > 0 ? (
            <ul className="space-y-3">
              {recentActivity.slice(0, 4).map((event) => (
                <li key={`${event.entityType}-${event.id}-activity`}>
                  <Link href={event.href} className="flex items-center justify-between gap-4 text-sm hover:text-[var(--operator-brand)]">
                    <span className="flex min-w-0 items-center gap-3">
                      <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-[#f8eef4] text-[var(--operator-brand)]">{activityMeta[event.entityType].icon}</span>
                      <span className="min-w-0">
                        <strong className="block truncate text-[#261a31]">{event.title}</strong>
                        <span className="text-[var(--operator-ink-muted)]">{activityActionLabel[event.action]} · {activityMeta[event.entityType].label}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-xs text-[var(--operator-ink-subtle)]">{formatRelativeTime(event.timestamp)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--operator-border)] bg-white p-5 text-sm text-[var(--operator-ink-muted)]">
              Todavía no hay actividad reciente.
            </div>
          )}
        </section>

        <section className="rounded-[1rem] border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
          <h2 className="mb-4 text-xl font-extrabold tracking-[-0.04em] text-[var(--operator-brand)]">Cliente destacado</h2>
          <div className="rounded-2xl bg-[#fff8f3] p-4">
            <p className="text-lg font-bold text-[#24172f]">{upcomingBirthdays[0]?.name ?? "Carlos Méndez"}</p>
            <p className="text-sm text-[var(--operator-ink-muted)]">Próxima tarea · Confirmar tour</p>
            <Link href={upcomingBirthdays[0] ? `/dashboard/clients/${upcomingBirthdays[0].id}` : "/dashboard/clients"} className="mt-4 inline-flex text-sm font-bold text-[var(--operator-brand)] hover:underline">
              Ver perfil →
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <TripsTrendChart data={tripsPerMonth} />
        <div className="space-y-5">
          <IntegrationsStatusCard />
          <ClientsByReferralSourceCard counts={referralSourceCounts} />
        </div>
      </div>
    </main>
  );
}

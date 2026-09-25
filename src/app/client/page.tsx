import { redirect } from "next/navigation";
import { OperatorButton } from "@/components/ui/OperatorButton";
import { OperatorSurface } from "@/components/ui/OperatorSurface";
import { getClientSession } from "@/lib/client-auth";
import { getClientHomeTrips, getClientProfileForHome } from "@/lib/data";
import {
  getServiceForClientTrip,
  getServicesProgressForClient,
} from "@/lib/data/services";
import { clientLogout } from "./login/actions";

export default async function ClientHomePage() {
  const session = await getClientSession();
  if (!session) {
    redirect("/client/login?redirectTo=/client");
  }

  const profile = await getClientProfileForHome(session.clientId);
  const trips = await getClientHomeTrips(session.clientId);
  const progressByServiceId = await getServicesProgressForClient(
    session.clientId
  );
  const tripsWithProgress = await Promise.all(
    trips.map(async (trip) => {
      const service = await getServiceForClientTrip(session.clientId, trip.id);
      const progress = service ? progressByServiceId.get(service.id) : undefined;
      return { ...trip, serviceProgress: progress };
    })
  );

  return (
    <main
      className="min-h-screen bg-[var(--operator-canvas)] px-4 py-6 text-[var(--operator-ink)] sm:px-6 sm:py-10"
      data-testid="client-home-atmosphere"
    >
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-col gap-5 border-b border-[var(--operator-border)] pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--operator-ink-muted)]">
              TravelHub
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-[var(--operator-ink)] sm:text-4xl">
              {profile?.name ?? "Mi cuenta"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--operator-ink-muted)]">
              Tu información y los detalles de tus próximos viajes, en un solo lugar.
            </p>
          </div>
          <form action={clientLogout}>
            <OperatorButton type="submit" variant="secondary">
              Cerrar sesión
            </OperatorButton>
          </form>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <OperatorSurface
            className="h-fit p-5 sm:p-6"
            data-testid="client-profile-surface"
            variant="panel"
          >
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
              Mis datos
            </h2>
            <dl className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-1">
              <ProfileField label="Nombre" value={profile?.name ?? "—"} />
              <ProfileField label="Email" value={profile?.email ?? "—"} />
              <ProfileField label="Teléfono" value={profile?.phone ?? "—"} />
              <ProfileField label="WhatsApp" value={profile?.whatsapp ?? "—"} />
              <ProfileField label="Fecha de nacimiento" value={profile?.birthDate ?? "—"} />
              <ProfileField label="¿Cómo nos conoció?" value={profile?.referralSource ?? "—"} />
              <ProfileField
                className="sm:col-span-2 lg:col-span-1"
                label="Notas"
                value={profile?.notes ?? "—"}
              />
            </dl>
          </OperatorSurface>

          <OperatorSurface
            className="p-5 sm:p-6"
            data-testid="client-trips-surface"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
                Mis viajes
              </h2>
              <span className="text-sm text-[var(--operator-ink-muted)]">
                {tripsWithProgress.length} {tripsWithProgress.length === 1 ? "viaje" : "viajes"}
              </span>
            </div>

            {tripsWithProgress.length === 0 ? (
              <p className="mt-8 border-t border-[var(--operator-border-subtle)] pt-5 text-sm leading-6 text-[var(--operator-ink-muted)]">
                Todavía no tenés viajes cargados.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-[var(--operator-border-subtle)] border-t border-[var(--operator-border-subtle)]">
                {tripsWithProgress.map((trip) => (
                  <li key={trip.id} className="py-5 first:pt-5 last:pb-0">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        {trip.status === "published" ? (
                          <a
                            href={`/t/${trip.slug}`}
                            className="text-base font-semibold text-[var(--operator-brand)] underline decoration-[var(--operator-accent)] decoration-2 underline-offset-4 transition hover:text-[var(--operator-brand-strong)]"
                          >
                            {trip.title}
                          </a>
                        ) : (
                          <span className="text-base font-semibold text-[var(--operator-ink)]">
                            {trip.title}
                          </span>
                        )}
                        <p className="mt-2 text-sm leading-6 text-[var(--operator-ink-muted)]">
                          {trip.startDate} → {trip.endDate} · {trip.travelerCount} viajeros
                        </p>
                      </div>
                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
                          trip.status === "published"
                            ? "bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]"
                            : "bg-[var(--operator-accent)] text-[var(--operator-accent-foreground)]"
                        }`}
                      >
                        {trip.status === "published" ? "Publicado" : "Borrador"}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
                      <a
                        href={`/client/trips/${trip.id}/documents`}
                        className="font-semibold text-[var(--operator-brand)] underline decoration-[var(--operator-accent)] decoration-2 underline-offset-4 transition hover:text-[var(--operator-brand-strong)]"
                      >
                        Documentos
                      </a>
                      {trip.serviceProgress && trip.serviceProgress.total > 0 && (
                        <span className="text-[var(--operator-ink-muted)]">
                          {trip.serviceProgress.completed}/{trip.serviceProgress.total} documentos completados
                        </span>
                      )}
                    </div>
                    {(trip.salePrice !== undefined || trip.assignedAgentName) && (
                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--operator-border-subtle)] pt-4 text-sm text-[var(--operator-ink-muted)]">
                        {trip.salePrice !== undefined && (
                          <span>
                            Precio: {trip.salePrice.toLocaleString("es-AR")} {trip.currency}
                          </span>
                        )}
                        {trip.assignedAgentName && <span>Agente: {trip.assignedAgentName}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </OperatorSurface>
        </div>
      </div>
    </main>
  );
}

function ProfileField({
  className = "",
  label,
  value,
}: {
  className?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--operator-ink-subtle)]">
        {label}
      </dt>
      <dd className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-[var(--operator-ink)]">
        {value}
      </dd>
    </div>
  );
}

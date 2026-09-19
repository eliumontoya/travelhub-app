import { redirect } from "next/navigation";
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
      const service = await getServiceForClientTrip(
        session.clientId,
        trip.id
      );
      const progress = service
        ? progressByServiceId.get(service.id)
        : undefined;
      return { ...trip, serviceProgress: progress };
    })
  );

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {profile?.name ?? "Mi cuenta"}
        </h1>
        <form action={clientLogout}>
          <button
            type="submit"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cerrar sesión
          </button>
        </form>
      </header>

      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Mis datos</h2>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Nombre</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.email ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Teléfono</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">WhatsApp</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.whatsapp ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Fecha de nacimiento</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.birthDate ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">¿Cómo nos conoció?</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-white">{profile?.referralSource ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">Notas</dt>
            <dd className="mt-1 text-sm whitespace-pre-wrap text-gray-900 dark:text-white">{profile?.notes ?? "—"}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Mis viajes</h2>
        {tripsWithProgress.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">Todavía no tenés viajes cargados.</p>
        ) : (
          <ul className="space-y-4">
            {tripsWithProgress.map((trip) => (
              <li
                key={trip.id}
                className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    {trip.status === "published" ? (
                      <a
                        href={`/t/${trip.slug}`}
                        className="text-base font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {trip.title}
                      </a>
                    ) : (
                      <span className="text-base font-semibold text-gray-900 dark:text-white">{trip.title}</span>
                    )}
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {trip.startDate} → {trip.endDate} · {trip.travelerCount} viajeros
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      trip.status === "published"
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                    }`}
                  >
                    {trip.status === "published" ? "Publicado" : "Borrador"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                  <a
                    href={`/client/trips/${trip.id}/documents`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Documentos
                  </a>
                  {trip.serviceProgress && trip.serviceProgress.total > 0 && (
                    <span className="text-gray-600 dark:text-gray-400">
                      {trip.serviceProgress.completed}/{trip.serviceProgress.total}
                    </span>
                  )}
                </div>
                {(trip.salePrice !== undefined || trip.assignedAgentName) && (
                  <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
                    {trip.salePrice !== undefined && (
                      <span>Precio: {trip.salePrice.toLocaleString("es-AR")} {trip.currency}</span>
                    )}
                    {trip.assignedAgentName && <span>Agente: {trip.assignedAgentName}</span>}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { getClientPublishedTripsBySlug } from "@/lib/data";
import { formatDateLong } from "@/lib/item-meta";

export default async function ClientTripHistoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hub = await getClientPublishedTripsBySlug(slug);
  if (!hub) notFound();

  const { client, trips } = hub;

  return (
    <main className="min-h-screen bg-gray-50 pb-16 dark:bg-gray-950">
      <div className="flex h-40 items-end bg-gray-800 sm:h-48">
        <div className="mx-auto w-full max-w-2xl px-4 pb-6 text-white">
          <p className="text-sm text-white/70">Historial de viajes</p>
          <h1 className="text-3xl font-bold">{client.name}</h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        {trips.length === 0 ? (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="text-sm text-gray-500 dark:text-gray-400">Todavía no hay viajes publicados.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {trips.map((trip) => (
              <Link
                key={trip.id}
                href={`/t/${trip.slug}`}
                className="block rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              >
                <p className="font-medium text-gray-900 dark:text-gray-100">{trip.title}</p>
                {trip.startDate && trip.endDate && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {formatDateLong(trip.startDate)} – {formatDateLong(trip.endDate)}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

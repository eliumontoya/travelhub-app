import { notFound } from "next/navigation";
import { getTripWithDetails } from "@/lib/mock-data";
import { itemTypeMeta, formatDateLong } from "@/lib/item-meta";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { AddTripToCalendarButton } from "@/components/AddTripToCalendarButton";

export default async function PublicTripPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trip = getTripWithDetails(slug);
  if (!trip) notFound();

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      <div
        className="flex h-56 items-end bg-gray-800 bg-cover bg-center sm:h-72"
        style={{
          backgroundImage: trip.coverImageUrl
            ? `linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.1)), url(${trip.coverImageUrl})`
            : undefined,
        }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 pb-6 text-white">
          <h1 className="text-3xl font-bold">{trip.title}</h1>
          <p className="mt-1 text-sm text-white/80">
            {formatDateLong(trip.startDate)} – {formatDateLong(trip.endDate)}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4">
        <div className="my-6 flex justify-center">
          <AddTripToCalendarButton trip={trip} />
        </div>

        <div className="space-y-8">
          {trip.days.map((day) => (
            <div key={day.id}>
              <h2 className="mb-3 text-lg font-semibold capitalize text-gray-900">
                {formatDateLong(day.date)}
              </h2>
              <div className="space-y-3 border-l-2 border-gray-200 pl-4">
                {day.items.map((item) => {
                  const meta = itemTypeMeta[item.type];
                  return (
                    <div
                      key={item.id}
                      className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3">
                          <span className={`rounded-full px-2 py-1 text-lg ${meta.color}`}>
                            {meta.icon}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">{item.title}</span>
                              {item.startTime && (
                                <span className="text-xs text-gray-400">{item.startTime}</span>
                              )}
                            </div>
                            {item.location && (
                              <p className="text-sm text-gray-500">{item.location}</p>
                            )}
                            {item.notes && (
                              <p className="mt-1 text-sm text-gray-400">{item.notes}</p>
                            )}
                            {item.confirmationCode && (
                              <p className="mt-1 text-xs text-gray-400">
                                Confirmación: {item.confirmationCode}
                              </p>
                            )}
                          </div>
                        </div>
                        <AddToCalendarButton item={item} date={day.date} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

import { notFound } from "next/navigation";
import { getSiteSettings, getTripWithDetails } from "@/lib/data";
import { itemTypeMeta, formatDateLong } from "@/lib/item-meta";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { AddTripToCalendarButton } from "@/components/AddTripToCalendarButton";
import { LocationMap } from "@/components/LocationMap";
import { TripDaySidebar } from "@/components/TripDaySidebar";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DEFAULT_LANG, dictionary, getLangFromSearchParams } from "@/lib/i18n";

export default async function PublicTripPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const lang = getLangFromSearchParams(resolvedSearchParams) ?? DEFAULT_LANG;
  const t = dictionary[lang];
  const [trip, contact] = await Promise.all([getTripWithDetails(slug), getSiteSettings()]);
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
          <div className="mb-2 flex justify-end">
            <LanguageToggle lang={lang} />
          </div>
          <h1 className="text-3xl font-bold">{trip.title}</h1>
          <p className="mt-1 text-sm text-white/80">
            {formatDateLong(trip.startDate, lang)} – {formatDateLong(trip.endDate, lang)}
          </p>
          <p className="mt-1 text-sm text-white/80">
            <a href={`mailto:${contact.email}`} className="hover:underline">
              {contact.email}
            </a>
            {" · "}
            <a
              href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
              className="hover:underline"
            >
              {contact.phone}
            </a>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 lg:max-w-5xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-8">
        <TripDaySidebar
          days={trip.days}
          className="hidden lg:block lg:sticky lg:top-6 lg:self-start"
          lang={lang}
        />

        <div className="lg:max-w-2xl">
          {trip.instructions && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="whitespace-pre-line text-sm text-gray-700">{trip.instructions}</p>
            </div>
          )}

          <div className="my-6 flex justify-center">
            <AddTripToCalendarButton trip={trip} lang={lang} />
          </div>

          <div className="space-y-8">
            {trip.days.map((day) => (
              <div key={day.id} id={`day-${day.id}`} className="scroll-mt-6">
                <h2 className="mb-3 text-lg font-semibold capitalize text-gray-900">
                  {formatDateLong(day.date, lang)}
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
                            <span
                              className={`rounded-full px-2 py-1 text-lg ${meta.color}`}
                              title={t.itemType[item.type]}
                            >
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
                                  {t.confirmationLabel}: {item.confirmationCode}
                                </p>
                              )}
                              {item.lat !== undefined && item.lng !== undefined && (
                                <LocationMap lat={item.lat} lng={item.lng} label={item.location ?? item.title} />
                              )}
                            </div>
                          </div>
                          <AddToCalendarButton item={item} date={day.date} lang={lang} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

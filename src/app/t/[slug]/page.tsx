import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteSettings, getTripWithDetails } from "@/lib/data";
import { itemTypeMeta, formatDateLong, formatCost } from "@/lib/item-meta";
import { getApproxUtcOffsetLabel } from "@/lib/timezone";
import { formatItemMetadataSummary, getItemFlightNumber } from "@/lib/item-display";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { AddTripToCalendarButton } from "@/components/AddTripToCalendarButton";
import { LocationMap } from "@/components/LocationMap";
import { FlightStatusBadge } from "@/components/FlightStatusBadge";
import { TripDaySidebar } from "@/components/TripDaySidebar";
import { TripFeedbackForm } from "@/components/TripFeedbackForm";
import { SupplierInfo } from "@/components/SupplierInfo";
import { submitTripFeedbackAction } from "./actions";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DEFAULT_LANG, dictionary, getLangFromSearchParams } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WeatherBadge } from "@/components/WeatherBadge";
import { getDailyWeather } from "@/lib/weather";
import { PrintButton } from "@/components/PrintButton";
import type { ItemWithSupplier } from "@/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getTripWithDetails(slug);

  if (!trip) {
    return { title: "Itinerario no encontrado" };
  }

  const description = `${formatDateLong(trip.startDate)} – ${formatDateLong(trip.endDate)}`;

  return {
    title: trip.title,
    description,
    openGraph: {
      title: trip.title,
      description,
      images: trip.coverImageUrl ? [{ url: trip.coverImageUrl }] : undefined,
    },
  };
}

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
  if (!trip || trip.status !== "published") notFound();

  const totalCost = trip.showCostsToClient
    ? trip.days.reduce(
        (sum, day) => sum + day.items.reduce((daySum, item) => daySum + (item.cost ?? 0), 0),
        0
      )
    : 0;

  const dayWeather = await Promise.all(
    trip.days.map((day) => {
      const withLocation = day.items.find((item) => item.lat !== undefined && item.lng !== undefined);
      return getDailyWeather(withLocation?.lat, withLocation?.lng, day.date);
    })
  );

  const today = new Date().toISOString().slice(0, 10);
  const tripEnded = Boolean(trip.endDate) && trip.endDate < today;

  return (
    <main className="min-h-screen bg-gray-50 pb-16 print:bg-white print:pb-0 dark:bg-gray-950">
      <ThemeToggle className="fixed right-4 top-4 z-20 print:hidden" />
      <div
        className="flex h-56 items-end bg-gray-800 bg-cover bg-center sm:h-72 print:hidden"
        style={{
          backgroundImage: trip.coverImageUrl
            ? `linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.1)), url(${trip.coverImageUrl})`
            : undefined,
        }}
      >
        <div className="mx-auto w-full max-w-2xl px-4 pb-6 text-white">
          <div className="mb-2 flex items-start justify-between gap-4">
            {(contact.logoUrl || contact.agencyName) && (
              <div className="flex items-center gap-3">
                {contact.logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={contact.logoUrl}
                    alt={contact.agencyName ?? "Logo"}
                    className="h-12 w-auto rounded-lg bg-white/90 p-1 object-contain shadow-sm"
                  />
                )}
                {contact.agencyName && (
                  <span className="text-base font-semibold drop-shadow">
                    {contact.agencyName}
                  </span>
                )}
              </div>
            )}
            <LanguageToggle lang={lang} />
          </div>
          <h1 className="text-3xl font-bold">{trip.title}</h1>
          <p className="mt-1 text-sm text-white/80">
            {formatDateLong(trip.startDate, lang)} – {formatDateLong(trip.endDate, lang)}
            {" · "}
            {trip.travelerCount} {trip.travelerCount === 1 ? t.traveler : t.travelers}
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

      <div className="hidden print:block px-4 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">{trip.title}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {formatDateLong(trip.startDate, lang)} – {formatDateLong(trip.endDate, lang)}
        </p>
      </div>

      <div className="mx-auto max-w-2xl px-4 lg:max-w-5xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-8">
        <TripDaySidebar
          days={trip.days}
          className="hidden lg:block lg:sticky lg:top-6 lg:self-start print:hidden"
          lang={lang}
        />

        <div className="lg:max-w-2xl">
          {trip.instructions && (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:shadow-none print:border-gray-300 dark:border-gray-800 dark:bg-gray-900">
              <p className="whitespace-pre-line text-sm text-gray-700 dark:text-gray-300">{trip.instructions}</p>
            </div>
          )}

          <div className="my-6 flex justify-center gap-2 print:hidden">
            <AddTripToCalendarButton trip={trip} lang={lang} />
            <PrintButton />
          </div>

          {trip.photos.length > 0 && (
            <div className="mb-6 print:hidden">
              <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">Fotos</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {trip.photos.map((photo) =>
                  photo.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={photo.id}
                      src={photo.url}
                      alt={photo.fileName}
                      className="aspect-square rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : null
                )}
              </div>
            </div>
          )}

          {trip.showCostsToClient && (
            <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resumen de costos</h2>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCost(totalCost, trip.currency)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Total estimado del viaje</p>
            </div>
          )}

          <div className="space-y-8">
            {trip.days.map((day, dayIdx) => (
              <div key={day.id} id={`day-${day.id}`} className="scroll-mt-6 print:break-inside-avoid">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold capitalize text-gray-900 dark:text-gray-100">
                  {formatDateLong(day.date, lang)}
                  <WeatherBadge weather={dayWeather[dayIdx]} />
                </h2>
                <div className="space-y-3 border-l-2 border-gray-200 pl-4 dark:border-gray-800">
                  {day.items.map((rawItem) => {
                    const item = rawItem as ItemWithSupplier;
                    const meta = itemTypeMeta[item.type];
                    const tzLabel = getApproxUtcOffsetLabel(item.lat, item.lng);
                    return (
                      <div
                        key={item.id}
                        className="relative rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:break-inside-avoid print:shadow-none print:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
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
                                <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                                {item.startTime && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {item.startTime}
                                    {tzLabel && ` · ${tzLabel}`}
                                  </span>
                                )}
                                {item.type === "flight" && (
                                  <FlightStatusBadge
                                    title={item.title}
                                    flightNumber={getItemFlightNumber(item)}
                                  />
                                )}
                              </div>
                              {item.location && (
                                <p className="text-sm text-gray-500 dark:text-gray-400">{item.location}</p>
                              )}
                              {item.notes && (
                                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{item.notes}</p>
                              )}
                              {item.confirmationCode && (
                                <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                                  {t.confirmationLabel}: {item.confirmationCode}
                                </p>
                              )}
                              {formatItemMetadataSummary(item) && (
                                <p className={`mt-1 text-xs ${item.type === "flight" ? "font-medium text-sky-600 dark:text-sky-400" : "text-gray-400 dark:text-gray-500"}`}>
                                  {formatItemMetadataSummary(item)}
                                </p>
                              )}
                              {trip.showCostsToClient && item.cost !== undefined && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  Costo: {formatCost(item.cost, trip.currency)}
                                </p>
                              )}
                              {item.lat !== undefined && item.lng !== undefined && (
                                <div className="print:hidden">
                                  <LocationMap lat={item.lat} lng={item.lng} label={item.location ?? item.title} />
                                </div>
                              )}
                              {item.supplier && (
                                <SupplierInfo
                                  name={item.supplier.name}
                                  address={item.supplier.address}
                                />
                              )}
                            </div>
                          </div>
                          <div className="print:hidden">
                            <AddToCalendarButton item={item} date={day.date} lang={lang} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {tripEnded && (
            <div className="mt-8">
              <TripFeedbackForm onSubmit={submitTripFeedbackAction.bind(null, trip.id, trip.slug)} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSiteSettings, getTripWithDetails } from "@/lib/data";
import { itemTypeMeta, formatDateLong, formatCost } from "@/lib/item-meta";
import { getApproxUtcOffsetLabel } from "@/lib/timezone";
import { formatItemDetailRows, formatItemMetadataSummary, getItemFlightNumber } from "@/lib/item-display";
import { AddToCalendarButton } from "@/components/AddToCalendarButton";
import { AddTripToCalendarButton } from "@/components/AddTripToCalendarButton";
import { LocationActions } from "@/components/LocationMap";
import { FlightStatusBadge } from "@/components/FlightStatusBadge";
import { TripDaySidebar } from "@/components/TripDaySidebar";
import { TripFeedbackForm } from "@/components/TripFeedbackForm";
import { SupplierInfo } from "@/components/SupplierInfo";
import { NoteHtml } from "@/components/NoteHtml";
import { submitTripFeedbackAction } from "./actions";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DEFAULT_LANG, dictionary, getLangFromSearchParams } from "@/lib/i18n";
import { resolveItemLocation } from "@/lib/item-location";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WeatherBadge } from "@/components/WeatherBadge";
import { getDailyWeather } from "@/lib/weather";
import { PackingListManager } from "@/components/PackingListManager";
import { PrintButton } from "@/components/PrintButton";
import type { ItemWithSupplier } from "@/types";
import { isTravelerTripVisible } from "@/lib/trip-visibility";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const previewToken = getPreviewToken(resolvedSearchParams);
  const trip = await getTripWithDetails(slug);

  if (!trip || !isTravelerTripVisible(trip.status, trip.id, previewToken)) {
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
  const previewToken = getPreviewToken(resolvedSearchParams);
  const t = dictionary[lang];
  const [trip, contact] = await Promise.all([getTripWithDetails(slug), getSiteSettings()]);
  if (!trip || !isTravelerTripVisible(trip.status, trip.id, previewToken)) notFound();
  const isDraftPreview = trip.status === "draft";

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
      <ThemeToggle className="fixed right-4 top-4 z-30 print:hidden" />

      {isDraftPreview && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-800 print:hidden dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-300">
          Vista previa de borrador: esta URL temporal solo sirve para revisión. La URL final se activa al publicar el viaje.
        </div>
      )}

      <section
        className="bg-gray-900 bg-cover bg-center print:hidden"
        style={{
          backgroundImage: trip.coverImageUrl
            ? `linear-gradient(to top, rgba(15,23,42,0.88), rgba(15,23,42,0.35)), url(${trip.coverImageUrl})`
            : undefined,
        }}
      >
        <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-5 text-white shadow-2xl backdrop-blur-sm sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                {(contact.logoUrl || contact.agencyName) && (
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    {contact.logoUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={contact.logoUrl}
                        alt={contact.agencyName ?? "Logo"}
                        className="h-12 w-auto rounded-lg bg-white/90 p-1 object-contain shadow-sm"
                      />
                    )}
                    {contact.agencyName && (
                      <span className="text-base font-semibold drop-shadow break-words">
                        {contact.agencyName}
                      </span>
                    )}
                  </div>
                )}
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{trip.title}</h1>
                <p className="mt-2 text-sm text-white/80 sm:text-base">
                  {formatDateLong(trip.startDate, lang)} – {formatDateLong(trip.endDate, lang)}
                  {" · "}
                  {trip.travelerCount} {trip.travelerCount === 1 ? t.traveler : t.travelers}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/75">
                  <a href={`mailto:${contact.email}`} className="hover:text-white hover:underline">
                    {contact.email}
                  </a>
                  <a
                    href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}
                    className="hover:text-white hover:underline"
                  >
                    {contact.phone}
                  </a>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <LanguageToggle lang={lang} variant="light" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="hidden print:block px-4 pt-4">
        <h1 className="text-2xl font-bold text-gray-900">{trip.title}</h1>
        <p className="mt-1 text-sm text-gray-600">
          {formatDateLong(trip.startDate, lang)} – {formatDateLong(trip.endDate, lang)}
        </p>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[220px_minmax(0,1fr)_320px] print:block print:max-w-3xl print:py-0">
        <aside className="hidden lg:block print:hidden">
          <div className="sticky top-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {t.daysNav}
            </p>
            <TripDaySidebar days={trip.days} lang={lang} />
          </div>
        </aside>

        <section className="order-3 min-w-0 space-y-6 lg:order-none print:space-y-4">
          <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 shadow-sm print:hidden dark:border-blue-950 dark:bg-blue-950/20">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t.daysNav}</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Todo el viaje organizado por día, con horarios, ubicaciones y documentos importantes.
            </p>
          </div>

          <div className="space-y-8">
            {trip.days.map((day, dayIdx) => (
              <article
                key={day.id}
                id={`day-${day.id}`}
                className="scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 print:break-inside-avoid print:border-gray-300 print:shadow-none dark:border-gray-800 dark:bg-gray-900"
              >
                <header className="mb-4 flex flex-col gap-2 border-b border-gray-100 pb-4 sm:flex-row sm:items-center sm:justify-between print:border-b-0 print:pb-0 dark:border-gray-800">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Día {dayIdx + 1}</p>
                    <h2 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold capitalize text-gray-900 dark:text-gray-100">
                      {formatDateLong(day.date, lang)}
                      <WeatherBadge weather={dayWeather[dayIdx]} />
                    </h2>
                  </div>
                  <span className="w-fit rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {day.items.length} {day.items.length === 1 ? "item" : "items"}
                  </span>
                </header>

                {day.notes && (
                  <div className="mb-4 rounded-xl border border-dashed border-blue-100 bg-blue-50/50 px-3 py-2 print:border-gray-200 print:bg-white dark:border-blue-950 dark:bg-blue-950/20">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">
                      Nota del día
                    </p>
                    <NoteHtml html={day.notes} className="text-sm text-gray-600 dark:text-gray-400" />
                  </div>
                )}

                <div className="space-y-3">
                  {day.items.map((rawItem) => {
                    const item = rawItem as ItemWithSupplier;
                    const meta = itemTypeMeta[item.type];
                    const resolvedLocation = resolveItemLocation(item);
                    const tzLabel = getApproxUtcOffsetLabel(resolvedLocation?.lat ?? item.lat, resolvedLocation?.lng ?? item.lng);
                    const metadataSummary = formatItemMetadataSummary(item);
                    const detailRows = formatItemDetailRows(item);
                    const hasDetails = Boolean(
                      item.notes ||
                      item.confirmationCode ||
                      (trip.showCostsToClient && item.cost !== undefined) ||
                      detailRows.length > 0 ||
                      Boolean(resolvedLocation) ||
                      item.supplier ||
                      Boolean(item.documents?.length)
                    );
                    return (
                      <div
                        key={item.id}
                        className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 print:break-inside-avoid print:border-gray-300 print:bg-white dark:border-gray-800 dark:bg-gray-950/50"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1.5 text-lg ${meta.color}`}
                              title={t.itemType[item.type]}
                            >
                              {meta.icon}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                                  {t.itemType[item.type]}
                                </span>
                                {item.startTime && (
                                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-gray-500 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-400 dark:ring-gray-800">
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
                              {resolvedLocation && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{resolvedLocation.label}</p>
                              )}
                              {metadataSummary && (
                                <p className={`mt-1 text-xs ${item.type === "flight" ? "font-medium text-sky-600 dark:text-sky-400" : "text-gray-400 dark:text-gray-500"}`}>
                                  {metadataSummary}
                                </p>
                              )}
                              {hasDetails && (
                                <details className="group mt-3 rounded-lg border border-gray-200 bg-white/70 p-3 open:bg-white print:border-0 print:bg-white print:p-0 dark:border-gray-800 dark:bg-gray-900/60 dark:open:bg-gray-900">
                                  <summary className="cursor-pointer list-none text-sm font-medium text-blue-600 hover:text-blue-700 print:hidden dark:text-blue-400 dark:hover:text-blue-300">
                                    <span className="group-open:hidden">Ver más detalles</span>
                                    <span className="hidden group-open:inline">Ver menos</span>
                                  </summary>
                                  <div className="mt-3 space-y-3 print:mt-0">
                                    {item.notes && (
                                      <NoteHtml
                                        html={item.notes}
                                        className="text-sm text-gray-600 dark:text-gray-400"
                                      />
                                    )}
                                    {(item.confirmationCode || (trip.showCostsToClient && item.cost !== undefined) || detailRows.length > 0) && (
                                      <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                        {item.confirmationCode && (
                                          <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{t.confirmationLabel}</dt>
                                            <dd className="text-gray-700 dark:text-gray-300">{item.confirmationCode}</dd>
                                          </div>
                                        )}
                                        {trip.showCostsToClient && item.cost !== undefined && (
                                          <div>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Costo</dt>
                                            <dd className="text-gray-700 dark:text-gray-300">{formatCost(item.cost, trip.currency)}</dd>
                                          </div>
                                        )}
                                        {detailRows.map((row) => (
                                          <div key={`${item.id}-${row.label}`}>
                                            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">{row.label}</dt>
                                            <dd className="text-gray-700 dark:text-gray-300">{row.value}</dd>
                                          </div>
                                        ))}
                                      </dl>
                                    )}
                                    {Boolean(item.documents?.length) && (
                                      <div>
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Documentos</p>
                                        <ul className="space-y-2">
                                          {item.documents?.map((doc) => (
                                            <li key={doc.id}>
                                              {doc.url ? (
                                                <a
                                                  href={doc.url}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:underline dark:border-gray-800 dark:bg-gray-950 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                                >
                                                  <span>📎</span>
                                                  <span className="truncate">{doc.fileName}</span>
                                                </a>
                                              ) : (
                                                <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
                                                  <span>📎</span>
                                                  <span className="truncate">{doc.fileName}</span>
                                                </span>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {item.supplier && (
                                      <SupplierInfo
                                        name={item.supplier.name}
                                        address={item.supplier.address}
                                        lat={item.supplier.lat}
                                        lng={item.supplier.lng}
                                      />
                                    )}
                                    {resolvedLocation && (
                                      <div className="print:hidden">
                                        <LocationActions
                                          lat={resolvedLocation.lat}
                                          lng={resolvedLocation.lng}
                                          address={resolvedLocation.address}
                                          label={resolvedLocation.label}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          </div>
                          <div className="shrink-0 print:hidden">
                            <AddToCalendarButton item={item} date={day.date} lang={lang} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="order-2 space-y-4 lg:order-none print:hidden">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Acciones del viaje</h2>
            <div className="mt-3 grid gap-2">
              <AddTripToCalendarButton trip={trip} lang={lang} />
              <PrintButton />
            </div>
          </section>

          {trip.instructions && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Instrucciones</h2>
              <NoteHtml
                html={trip.instructions}
                className="text-sm text-gray-700 dark:text-gray-300"
              />
            </section>
          )}

          {trip.showCostsToClient && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Resumen de costos</h2>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCost(totalCost, trip.currency)}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Total estimado del viaje</p>
            </section>
          )}

          {trip.photos.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Fotos</h2>
              <div className="grid grid-cols-2 gap-2">
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
            </section>
          )}

          {trip.documents.length > 0 && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Documentos del viaje</h2>
              <ul className="space-y-2">
                {trip.documents.map((doc) =>
                  doc.url ? (
                    <li key={doc.id}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate rounded-lg border border-gray-100 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 hover:underline dark:border-gray-800 dark:text-blue-400 dark:hover:bg-blue-950/30"
                      >
                        {doc.filename}
                      </a>
                    </li>
                  ) : null
                )}
              </ul>
            </section>
          )}

          {trip.packingItems.length > 0 && (
            <PackingListManager items={trip.packingItems} readOnly title={t.packingList} />
          )}

          {tripEnded && (
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <TripFeedbackForm onSubmit={submitTripFeedbackAction.bind(null, trip.id, trip.slug)} />
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}


function getPreviewToken(searchParams: Record<string, string | string[] | undefined>): string | undefined {
  const raw = searchParams.preview;
  return Array.isArray(raw) ? raw[0] : raw;
}

import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ALL_CLIENTS_PAGE_SIZE,
  ALL_SUPPLIERS_PAGE_SIZE,
  getClients,
  getSuppliers,
  getTags,
  getTripById,
  getTripFeedback,
  getTripInternalNotes,
} from "@/lib/data";
import {
  itemTypeMeta,
  formatDateLong,
  formatDateTime,
  formatAssignedClients,
  formatCost,
  formatTags,
  computeTripCompleteness,
} from "@/lib/item-meta";
import { getApproxUtcOffsetLabel } from "@/lib/timezone";
import { formatItemMetadataSummary, getItemFlightNumber } from "@/lib/item-display";
import { ItemFormDialog } from "@/components/ItemFormDialog";
import { MoveItemToDayDialog } from "@/components/MoveItemToDayDialog";
import { DayFormDialog } from "@/components/DayFormDialog";
import { GenerateDaysButton } from "@/components/GenerateDaysButton";
import { TripInstructionsDialog } from "@/components/TripInstructionsDialog";
import { TripInternalNotesDialog } from "@/components/TripInternalNotesDialog";
import { TripCommissionDialog } from "@/components/TripCommissionDialog";
import { TripCurrencyDialog } from "@/components/TripCurrencyDialog";
import { TripTravelerCountDialog } from "@/components/TripTravelerCountDialog";
import { TripBudgetDialog } from "@/components/TripBudgetDialog";
import { TripClientsManager } from "@/components/TripClientsManager";
import { TripTagsManager } from "@/components/TripTagsManager";
import { SaveAsTemplateDialog } from "@/components/SaveAsTemplateDialog";
import { TripPhotoGallery } from "@/components/TripPhotoGallery";
import { TripCoverImage } from "@/components/TripCoverImage";
import { TripDocuments } from "@/components/TripDocuments";
import { PackingListManager } from "@/components/PackingListManager";
import { ReorderButtons } from "@/components/ReorderButtons";
import { CopyUrlButtonClient } from "@/components/CopyUrlButton";
import { CopyTripSummaryButtonClient } from "@/components/CopyTripSummaryButton";
import { FlightStatusBadge } from "@/components/FlightStatusBadge";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import { DuplicateTripButton } from "@/components/DuplicateTripButton";
import { DeleteTripDialog } from "@/components/DeleteTripDialog";
import { DuplicateItemDialog } from "@/components/DuplicateItemDialog";
import { WeatherBadge } from "@/components/WeatherBadge";
import { LocationActions } from "@/components/LocationMap";
import { NoteHtml } from "@/components/NoteHtml";
import { travelerPreviewHref } from "@/lib/trip-visibility";
import { resolveItemLocation } from "@/lib/item-location";
import type { ItemWithSupplier } from "@/types";
import { getDailyWeather } from "@/lib/weather";
import { UndoToastHost } from "@/components/UndoToast";
import { PrintButton } from "@/components/PrintButton";
import {
  TripEditorShortcuts,
  ADD_DAY_TRIGGER_ID,
  ADD_ITEM_LAST_DAY_TRIGGER_ID,
} from "@/components/TripEditorShortcuts";
import {
  addDayAction,
  addItemAction,
  addPackingItemAction,
  deleteDayAction,
  deleteDocumentAction,
  deleteItemAction,
  deleteTripPhotoAction,
  deleteTripDocumentAction,
  deleteTripAction,
  duplicateTripAction,
  duplicateItemAction,
  deletePackingItemAction,
  editDayAction,
  editItemAction,
  generateTripDaysAction,
  getItemDocumentsAction,
  moveDayAction,
  moveItemAction,
  moveItemToDayAction,
  publishTripStatusAction,
  restoreDayAction,
  restoreItemAction,
  saveTripAsTemplateAction,
  setShowCostsToClientAction,
  setTripClientsAction,
  setTripTagsAction,
  togglePackingItemAction,
  updateTripBudgetAction,
  updateTripCommissionAction,
  updateTripCurrencyAction,
  updateTripInstructionsAction,
  updateTripInternalNotesAction,
  updateTripTravelerCountAction,
  uploadDocumentAction,
  uploadTripDocumentAction,
  uploadTripPhotoAction,
  uploadTripCoverAction,
  removeTripCoverAction,
  getTripDocumentsAction,
} from "./actions";

const documentsEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const photosEnabled = documentsEnabled;
const coversEnabled = photosEnabled;

const statusMeta = {
  draft: { label: "Borrador", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300" },
  published: { label: "Publicado", color: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400" },
  archived: { label: "Archivado", color: "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" },
};

export default async function TripEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [trip, { items: clients }, tags, internalNotes, { items: allSuppliers }] =
    await Promise.all([
      getTripById(id),
      getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
      getTags(),
      getTripInternalNotes(id),
      getSuppliers({ pageSize: ALL_SUPPLIERS_PAGE_SIZE }),
    ]);
  if (!trip) notFound();
  const feedback = await getTripFeedback(trip.id);

  const dayOrder = trip.days.map((d) => ({ id: d.id, sortOrder: d.sortOrder }));
  const tripDateRangeDays = countDaysInRange(trip.startDate, trip.endDate);
  const completeness = computeTripCompleteness(trip);

  const totalCost = trip.days.reduce(
    (daysSum, day) => daysSum + day.items.reduce((itemsSum, item) => itemsSum + (item.cost ?? 0), 0),
    0
  );
  const hasAnyCost = trip.days.some((day) => day.items.some((item) => item.cost !== undefined));
  const budgetDiff = trip.budget !== undefined ? trip.budget - totalCost : undefined;
  const isPublished = trip.status === "published";
  const isEditable = !isPublished;
  const travelerHref = travelerPreviewHref(trip.slug, trip.id, trip.status);

  const dayWeather = await Promise.all(
    trip.days.map((day) => {
      const withLocation = day.items.find((item) => item.lat !== undefined && item.lng !== undefined);
      return getDailyWeather(withLocation?.lat, withLocation?.lng, day.date);
    })
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 print:max-w-3xl print:py-0">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:underline print:hidden dark:text-gray-400">
        ← Volver
      </Link>

      <section className="mt-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm print:mt-0 print:border-0 print:shadow-none dark:border-gray-800 dark:bg-gray-950">
        <div className="border-b border-gray-100 bg-gradient-to-br from-slate-50 via-white to-blue-50 p-5 dark:border-gray-800 dark:from-gray-950 dark:via-gray-950 dark:to-blue-950/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{trip.title}</h1>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium print:hidden ${statusMeta[trip.status].color}`}>
                  {statusMeta[trip.status].label}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                {formatAssignedClients(trip.clients)} · {trip.travelerCount}{" "}
                {trip.travelerCount === 1 ? "viajero" : "viajeros"}
              </p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                {formatDateLong(trip.startDate)} – {formatDateLong(trip.endDate)}
              </p>
              {trip.tags.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-1.5 print:hidden">
                  {formatTags(trip.tags).map((name) => (
                    <li
                      key={name}
                      className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                    >
                      {name}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap gap-2 print:hidden lg:justify-end">
              <form action={publishTripStatusAction.bind(null, trip.id, trip.status === "published" ? "draft" : "published")}>
                <button
                  type="submit"
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-white"
                >
                  {trip.status === "published" ? "Pasar a borrador" : "Publicar"}
                </button>
              </form>
              <Link
                href={travelerHref}
                target="_blank"
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {trip.status === "draft" ? "Vista previa borrador" : "Vista previa"}
              </Link>
              <Link
                href={`/dashboard/trips/${trip.id}/quote`}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cotización
              </Link>
              {trip.status === "published" && (
                <>
                  <CopyUrlButtonClient slug={trip.slug} />
                  <ShareWhatsAppButton slug={trip.slug} title={trip.title} />
                </>
              )}
            </div>
          </div>
        </div>

        {isPublished && (
          <div className="border-b border-green-100 bg-green-50 px-5 py-3 text-sm text-green-800 print:hidden dark:border-green-950 dark:bg-green-950/20 dark:text-green-300">
            Viaje publicado bloqueado. Pásalo a borrador para editar días, itinerario o acciones.
          </div>
        )}

        <div className="grid gap-6 p-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:p-5 print:block print:p-0">
          <aside className="print:hidden">
            <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Días del viaje</p>
              <nav className="mt-3 space-y-1">
                {trip.days.map((day, idx) => (
                  <a
                    key={day.id}
                    href={`#day-${day.id}`}
                    className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-blue-50 hover:text-blue-700 dark:text-gray-400 dark:hover:bg-blue-950/40 dark:hover:text-blue-300"
                  >
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-gray-400 group-hover:text-blue-500">Día {idx + 1}</span>
                      <span className="block truncate font-medium capitalize">{formatDateLong(day.date)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${day.items.length === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"}`}>
                      {day.items.length}
                    </span>
                  </a>
                ))}
              </nav>
              {isEditable && (
              <div className="mt-4 space-y-2">
                <DayFormDialog
                  trigger={
                    <button
                      id={ADD_DAY_TRIGGER_ID}
                      className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      + Agregar día
                    </button>
                  }
                  onSubmit={addDayAction.bind(null, trip.id)}
                />
                {tripDateRangeDays !== null && (
                  <GenerateDaysButton
                    totalDays={tripDateRangeDays}
                    onGenerate={generateTripDaysAction.bind(null, trip.id)}
                  />
                )}
              </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 space-y-5 print:space-y-3">
            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 print:hidden dark:border-blue-950 dark:bg-blue-950/20">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Itinerario por días</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Configura las fechas e items del viaje desde esta línea de tiempo.
                  </p>
                </div>
                {trip.days.length > 0 && (
                  <a
                    href={`#day-${trip.days[trip.days.length - 1].id}`}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Ir al último día
                  </a>
                )}
              </div>
            </div>

            {trip.days.map((day, dayWeatherIdx) => {
              const itemOrder = day.items.map((i) => ({ id: i.id, sortOrder: i.sortOrder }));
              const dayIdx = dayOrder.findIndex((d) => d.id === day.id);
              const isLastDay = dayIdx === dayOrder.length - 1;

              return (
                <div
                  key={day.id}
                  id={`day-${day.id}`}
                  className="scroll-mt-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 print:break-inside-avoid print:border-gray-300 print:shadow-none dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="mb-4 flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between print:border-b-0 print:pb-0 dark:border-gray-800">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-500">Día {dayIdx + 1}</p>
                      <h3 className="mt-1 flex flex-wrap items-center gap-2 font-semibold capitalize text-gray-900 dark:text-gray-100">
                        {formatDateLong(day.date)}
                        <WeatherBadge weather={dayWeather[dayWeatherIdx]} />
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {day.items.length === 0
                          ? "Sin items todavía"
                          : `${day.items.length} ${day.items.length === 1 ? "item configurado" : "items configurados"}`}
                      </p>
                    </div>
                    {isEditable && (
                    <div className="flex items-center gap-2 self-start print:hidden">
                      <ReorderButtons
                        disableUp={dayIdx === 0}
                        disableDown={dayIdx === dayOrder.length - 1}
                        onMoveUp={moveDayAction.bind(null, trip.id, dayOrder, day.id, "up")}
                        onMoveDown={moveDayAction.bind(null, trip.id, dayOrder, day.id, "down")}
                      />
                      <DayFormDialog
                        day={day}
                        trigger={
                          <button className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200">
                            ✏️ Editar día
                          </button>
                        }
                        onSubmit={editDayAction.bind(null, trip.id, day.id)}
                        onDelete={deleteDayAction.bind(null, trip.id, day.id)}
                        onUndoDelete={restoreDayAction.bind(null, trip.id, day.id)}
                      />
                    </div>
                    )}
                  </div>

                  {day.notes && (
                    <div className="mb-4 rounded-xl border border-dashed border-blue-100 bg-blue-50/50 px-3 py-2 print:border-gray-200 print:bg-white dark:border-blue-950 dark:bg-blue-950/20">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">
                        Nota del día
                      </p>
                      <NoteHtml html={day.notes} className="text-sm text-gray-600 dark:text-gray-400" />
                    </div>
                  )}

                  <div className="space-y-3">
                    {day.items.length === 0 && (
                      <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 print:hidden dark:border-amber-950 dark:bg-amber-950/20 dark:text-amber-300">
{isEditable ? "Este día está vacío. Agrega vuelos, hoteles, actividades o notas para completar el itinerario." : "Este día no tiene items."}
                      </div>
                    )}

                    {day.items.map((item) => {
                      const itemWithSupplier = item as ItemWithSupplier;
                      const meta = itemTypeMeta[item.type];
                      const itemIdx = itemOrder.findIndex((i) => i.id === item.id);
                      const resolvedLocation = resolveItemLocation(itemWithSupplier);
                      const tzLabel = getApproxUtcOffsetLabel(resolvedLocation?.lat ?? item.lat, resolvedLocation?.lng ?? item.lng);
                      return (
                        <div
                          key={item.id}
                          className="group flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 transition hover:border-blue-100 hover:bg-white sm:flex-row sm:items-start print:break-inside-avoid print:bg-white dark:border-gray-800 dark:bg-gray-950/50 dark:hover:border-blue-950 dark:hover:bg-gray-900"
                        >
                          <span className={`w-fit rounded-full px-2.5 py-1.5 text-lg ${meta.color}`}>
                            {meta.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
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
                            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                              {item.cost !== undefined && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">Costo: {formatCost(item.cost, trip.currency)}</p>
                              )}
                              {item.confirmationCode && (
                                <p className="text-xs text-gray-400 dark:text-gray-500">
                                  Confirmación: {item.confirmationCode}
                                </p>
                              )}
                            </div>
                            {formatItemMetadataSummary(item) && (
                              <p className={`mt-1 text-xs ${item.type === "flight" ? "font-medium text-sky-600 dark:text-sky-400" : "text-gray-400 dark:text-gray-500"}`}>
                                {formatItemMetadataSummary(item)}
                              </p>
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
                          {isEditable && (
                          <div className="flex items-center gap-2 self-end sm:self-start print:hidden">
                            <ReorderButtons
                              disableUp={itemIdx === 0}
                              disableDown={itemIdx === itemOrder.length - 1}
                              onMoveUp={moveItemAction.bind(null, trip.id, itemOrder, item.id, "up")}
                              onMoveDown={moveItemAction.bind(null, trip.id, itemOrder, item.id, "down")}
                            />
                            <MoveItemToDayDialog
                              tripId={trip.id}
                              itemId={item.id}
                              days={trip.days.map((d) => ({ id: d.id, date: d.date }))}
                              currentDayId={day.id}
                              onMove={moveItemToDayAction}
                              trigger={
                                <button
                                  type="button"
                                  className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                  aria-label="Mover a otro día"
                                  title="Mover a otro día"
                                >
                                  📅
                                </button>
                              }
                            />
                            <ItemFormDialog
                              item={item}
                              allSuppliers={allSuppliers}
                              trigger={
                                <button className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">
                                  ✏️
                                </button>
                              }
                              onSubmit={editItemAction.bind(null, trip.id, item.id)}
                              onDelete={deleteItemAction.bind(null, trip.id, item.id)}
                              onUndoDelete={restoreItemAction.bind(null, trip.id, item.id)}
                              documentsEnabled={documentsEnabled}
                              onLoadDocuments={getItemDocumentsAction.bind(null, item.id)}
                              onUploadDocument={uploadDocumentAction.bind(null, trip.id, item.id)}
                              onDeleteDocument={deleteDocumentAction.bind(null, trip.id)}
                            />
                            <DuplicateItemDialog
                              itemTitle={item.title}
                              days={trip.days.map((d) => ({ id: d.id, date: d.date }))}
                              sourceDayId={day.id}
                              onDuplicate={duplicateItemAction.bind(null, trip.id, item.id)}
                              trigger={
                                <button
                                  type="button"
                                  title="Duplicar en otro día"
                                  className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                                >
                                  ⧉
                                </button>
                              }
                            />
                          </div>
                          )}
                        </div>
                      );
                    })}

                    {isEditable && (
                    <ItemFormDialog
                      allSuppliers={allSuppliers}
                      trigger={
                        <button
                          id={isLastDay ? ADD_ITEM_LAST_DAY_TRIGGER_ID : undefined}
                          className="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 print:hidden dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                        >
                          + Agregar item a este día
                        </button>
                      }
                      onSubmit={addItemAction.bind(null, trip.id, day.id)}
                    />
                    )}
                  </div>
                </div>
              );
            })}

            {isEditable && (
            <div className="flex flex-col gap-2 sm:flex-row lg:hidden print:hidden">
              <DayFormDialog
                trigger={
                  <button
                    className="w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    + Agregar día
                  </button>
                }
                onSubmit={addDayAction.bind(null, trip.id)}
              />
              {tripDateRangeDays !== null && (
                <GenerateDaysButton
                  totalDays={tripDateRangeDays}
                  onGenerate={generateTripDaysAction.bind(null, trip.id)}
                />
              )}
            </div>
            )}
          </section>

          <aside className="space-y-4 print:hidden">
            <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Acciones</h2>
              <div className="mt-3 grid grid-cols-1 gap-2">
                {isEditable ? (
                <>
                <form action={setShowCostsToClientAction.bind(null, trip.id, trip.slug, !trip.showCostsToClient)}>
                  <button
                    type="submit"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    {trip.showCostsToClient ? "Ocultar costos al cliente" : "Mostrar costos al cliente"}
                  </button>
                </form>
                <TripClientsManager
                  clients={clients}
                  assignedClientIds={trip.clients.map((c) => c.id)}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Gestionar clientes
                    </button>
                  }
                  onSubmit={setTripClientsAction.bind(null, trip.id)}
                />
                <TripTagsManager
                  tags={tags}
                  assignedTagIds={trip.tags.map((t) => t.id)}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Gestionar tags
                    </button>
                  }
                  onSubmit={setTripTagsAction.bind(null, trip.id)}
                />
                <TripInstructionsDialog
                  trip={trip}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Instrucciones
                    </button>
                  }
                  onSubmit={updateTripInstructionsAction.bind(null, trip.id, trip.slug)}
                />
                <TripInternalNotesDialog
                  internalNotes={internalNotes}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Notas internas
                    </button>
                  }
                  onSubmit={updateTripInternalNotesAction.bind(null, trip.id)}
                />
                <TripCurrencyDialog
                  trip={trip}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Moneda ({trip.currency})
                    </button>
                  }
                  onSubmit={updateTripCurrencyAction.bind(null, trip.id)}
                />
                <TripTravelerCountDialog
                  trip={trip}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      # Viajeros
                    </button>
                  }
                  onSubmit={updateTripTravelerCountAction.bind(null, trip.id, trip.slug)}
                />
                <TripBudgetDialog
                  trip={trip}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Presupuesto
                    </button>
                  }
                  onSubmit={updateTripBudgetAction.bind(null, trip.id)}
                />
                <TripCommissionDialog
                  trip={trip}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Comisión
                    </button>
                  }
                  onSubmit={updateTripCommissionAction.bind(null, trip.id)}
                />
                </>
                ) : (
                  <p className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-950 dark:bg-green-950/20 dark:text-green-300">
                    Las acciones de edición están bloqueadas mientras el viaje está publicado.
                  </p>
                )}
                {isEditable && (
                <>
                <CopyTripSummaryButtonClient trip={trip} />
                <SaveAsTemplateDialog
                  defaultTitle={trip.title}
                  trigger={
                    <button
                      type="button"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      Guardar como plantilla
                    </button>
                  }
                  onSubmit={saveTripAsTemplateAction.bind(null, trip.id)}
                />
                <DuplicateTripButton onDuplicate={duplicateTripAction.bind(null, trip.id)} />
                </>
                )}
                <PrintButton />
              </div>
            </section>

            <section className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-950 dark:bg-red-950/10">
              <h2 className="text-sm font-semibold text-red-800 dark:text-red-300">Zona de peligro</h2>
              <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                Borra definitivamente este viaje y sus datos relacionados.
              </p>
              <div className="mt-3">
                <DeleteTripDialog tripTitle={trip.title} action={deleteTripAction.bind(null, trip.id)} />
              </div>
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Finanzas</h2>
              {(hasAnyCost || trip.budget !== undefined) ? (
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-500 dark:text-gray-400">Costo total</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCost(totalCost, trip.currency)}</span>
                  </div>
                  {trip.budget !== undefined && (
                    <>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">Presupuesto</span>
                        <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCost(trip.budget, trip.currency)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-gray-500 dark:text-gray-400">
                          {budgetDiff !== undefined && budgetDiff < 0 ? "Excedido" : "Disponible"}
                        </span>
                        <span
                          className={`font-semibold ${
                            budgetDiff !== undefined && budgetDiff < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-green-700 dark:text-green-400"
                          }`}
                        >
                          {formatCost(Math.abs(budgetDiff ?? 0), trip.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-400">Sin costos registrados.</p>
              )}
            </section>

            <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Completitud</h2>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {completeness.documentPercentage}%
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${completeness.documentPercentage}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {completeness.itemsWithDocuments} de {completeness.totalItems} items tienen documentos.
              </p>
              {completeness.emptyDays.length > 0 && (
                <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
                  {completeness.emptyDays.length === 1
                    ? `1 día sin items: ${formatDateLong(completeness.emptyDays[0].date)}`
                    : `${completeness.emptyDays.length} días sin items`}
                </p>
              )}
            </section>

            {isEditable && (
            <TripCoverImage
              coverImageUrl={trip.coverImageUrl}
              coversEnabled={coversEnabled}
              onUpload={uploadTripCoverAction.bind(null, trip.id, trip.slug)}
              onRemove={removeTripCoverAction.bind(null, trip.id, trip.slug)}
            />
            )}

            {isEditable && (
            <TripPhotoGallery
              photos={trip.photos}
              photosEnabled={photosEnabled}
              onUpload={uploadTripPhotoAction.bind(null, trip.id, trip.slug)}
              onDelete={deleteTripPhotoAction.bind(null, trip.id, trip.slug)}
            />
            )}

            {isEditable && (
            <TripDocuments
              documents={trip.documents}
              documentsEnabled={documentsEnabled}
              onUpload={uploadTripDocumentAction.bind(null, trip.id, trip.slug)}
              onDelete={deleteTripDocumentAction.bind(null, trip.id, trip.slug)}
              onRefresh={getTripDocumentsAction.bind(null, trip.id)}
            />
            )}

            {isEditable && (
            <PackingListManager
              items={trip.packingItems}
              onAdd={addPackingItemAction.bind(null, trip.id)}
              onToggle={togglePackingItemAction.bind(null, trip.id)}
              onDelete={deletePackingItemAction.bind(null, trip.id)}
            />
            )}

            {trip.statusHistory.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Historial de estado</h2>
                <ul className="space-y-1.5">
                  {[...trip.statusHistory].reverse().map((entry) => (
                    <li key={entry.id} className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="block text-xs text-gray-400 dark:text-gray-500">{formatDateTime(entry.changedAt)}</span>
                      <span>
                        {entry.fromStatus ? (
                          <>
                            {statusMeta[entry.fromStatus].label} →{" "}
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {statusMeta[entry.toStatus].label}
                            </span>
                          </>
                        ) : (
                          <>
                            Creado como{" "}
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {statusMeta[entry.toStatus].label}
                            </span>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {feedback.length > 0 && (
              <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">Feedback recibido</h3>
                <div className="space-y-3">
                  {feedback.map((f) => (
                    <div key={f.id} className="rounded-lg border border-gray-100 p-3 dark:border-gray-800">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-amber-400">
                          {"★".repeat(f.rating)}
                          <span className="text-gray-300 dark:text-gray-600">{"★".repeat(5 - f.rating)}</span>
                        </span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{formatDateLong(f.createdAt.slice(0, 10))}</span>
                      </div>
                      {f.comment && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{f.comment}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </section>

      <TripEditorShortcuts />
      <UndoToastHost />
    </main>
  );
}

function countDaysInRange(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

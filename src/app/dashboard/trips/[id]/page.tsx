import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ALL_CLIENTS_PAGE_SIZE,
  getClients,
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
import { ItemFormDialog } from "@/components/ItemFormDialog";
import { DayFormDialog } from "@/components/DayFormDialog";
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
import { PackingListManager } from "@/components/PackingListManager";
import { ReorderButtons } from "@/components/ReorderButtons";
import { CopyUrlButtonClient } from "@/components/CopyUrlButton";
import { FlightStatusBadge } from "@/components/FlightStatusBadge";
import { ShareWhatsAppButton } from "@/components/ShareWhatsAppButton";
import { DuplicateTripButton } from "@/components/DuplicateTripButton";
import { WeatherBadge } from "@/components/WeatherBadge";
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
  duplicateTripAction,
  deletePackingItemAction,
  editDayAction,
  editItemAction,
  getItemDocumentsAction,
  moveDayAction,
  moveItemAction,
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
  uploadTripPhotoAction,
} from "./actions";

const documentsEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const photosEnabled = documentsEnabled;

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
  const [trip, { items: clients }, tags, internalNotes] = await Promise.all([
    getTripById(id),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    getTags(),
    getTripInternalNotes(id),
  ]);
  if (!trip) notFound();
  const feedback = await getTripFeedback(trip.id);

  const dayOrder = trip.days.map((d) => ({ id: d.id, sortOrder: d.sortOrder }));
  const completeness = computeTripCompleteness(trip);

  const totalCost = trip.days.reduce(
    (daysSum, day) => daysSum + day.items.reduce((itemsSum, item) => itemsSum + (item.cost ?? 0), 0),
    0
  );
  const hasAnyCost = trip.days.some((day) => day.items.some((item) => item.cost !== undefined));
  const budgetDiff = trip.budget !== undefined ? trip.budget - totalCost : undefined;

  const dayWeather = await Promise.all(
    trip.days.map((day) => {
      const withLocation = day.items.find((item) => item.lat !== undefined && item.lng !== undefined);
      return getDailyWeather(withLocation?.lat, withLocation?.lng, day.date);
    })
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:py-0">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:underline print:hidden dark:text-gray-400">
        ← Volver
      </Link>

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:mt-0">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{trip.title}</h1>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium print:hidden ${statusMeta[trip.status].color}`}>
              {statusMeta[trip.status].label}
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatAssignedClients(trip.clients)}
            {" · "}
            {trip.travelerCount} {trip.travelerCount === 1 ? "viajero" : "viajeros"}
          </p>
          {trip.tags.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1.5 print:hidden">
              {formatTags(trip.tags).map((name) => (
                <li
                  key={name}
                  className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                >
                  {name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <form action={publishTripStatusAction.bind(null, trip.id, trip.status === "published" ? "draft" : "published")}>
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {trip.status === "published" ? "Pasar a borrador" : "Publicar"}
            </button>
          </form>
          <form
            action={setShowCostsToClientAction.bind(null, trip.id, trip.slug, !trip.showCostsToClient)}
          >
            <button
              type="submit"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {trip.showCostsToClient
                ? "Ocultar costos al cliente"
                : "Mostrar costos al cliente"}
            </button>
          </form>
          <TripClientsManager
            clients={clients}
            assignedClientIds={trip.clients.map((c) => c.id)}
            trigger={
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
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
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Comisión
              </button>
            }
            onSubmit={updateTripCommissionAction.bind(null, trip.id)}
          />
          <Link
            href={`/t/${trip.slug}`}
            target="_blank"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Vista previa
          </Link>
          <Link
            href={`/dashboard/trips/${trip.id}/quote`}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Cotización
          </Link>
          <CopyUrlButtonClient slug={trip.slug} />
          <ShareWhatsAppButton slug={trip.slug} title={trip.title} />
          <SaveAsTemplateDialog
            defaultTitle={trip.title}
            trigger={
              <button
                type="button"
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Guardar como plantilla
              </button>
            }
            onSubmit={saveTripAsTemplateAction.bind(null, trip.id)}
          />
          <DuplicateTripButton onDuplicate={duplicateTripAction.bind(null, trip.id)} />
          <PrintButton />
        </div>
      </div>

      <div className="mb-6 print:hidden">
        <TripPhotoGallery
          photos={trip.photos}
          photosEnabled={photosEnabled}
          onUpload={uploadTripPhotoAction.bind(null, trip.id, trip.slug)}
          onDelete={deleteTripPhotoAction.bind(null, trip.id, trip.slug)}
        />
      </div>

      {(hasAnyCost || trip.budget !== undefined) && (
        <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 text-sm sm:p-5 print:hidden dark:border-gray-800 dark:bg-gray-900">
          <div>
            <span className="text-gray-500 dark:text-gray-400">Costo total: </span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCost(totalCost, trip.currency)}</span>
          </div>
          {trip.budget !== undefined && (
            <>
              <div>
                <span className="text-gray-500 dark:text-gray-400">Presupuesto: </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCost(trip.budget, trip.currency)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400">
                  {budgetDiff !== undefined && budgetDiff < 0 ? "Excedido: " : "Disponible: "}
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
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:hidden dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Completitud del itinerario</h3>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {completeness.documentPercentage}% con documentos
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${completeness.documentPercentage}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {completeness.itemsWithDocuments} de {completeness.totalItems} items tienen al menos un
          documento adjunto.
        </p>
        {completeness.emptyDays.length > 0 && (
          <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
            {completeness.emptyDays.length === 1
              ? `1 día sin items: ${formatDateLong(completeness.emptyDays[0].date)}`
              : `${completeness.emptyDays.length} días sin items: ${completeness.emptyDays
                  .map((d) => formatDateLong(d.date))
                  .join(", ")}`}
          </p>
        )}
      </div>

      <div className="mb-6 print:hidden">
        <PackingListManager
          items={trip.packingItems}
          onAdd={addPackingItemAction.bind(null, trip.id)}
          onToggle={togglePackingItemAction.bind(null, trip.id)}
          onDelete={deletePackingItemAction.bind(null, trip.id)}
        />
      </div>

      {trip.statusHistory.length > 0 && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:hidden dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">Historial de estado</h2>
          <ul className="space-y-1.5">
            {[...trip.statusHistory].reverse().map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-400 dark:text-gray-500">{formatDateTime(entry.changedAt)}</span>
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
        </div>
      )}

      <div className="space-y-6 print:space-y-3">
        {trip.days.map((day, dayWeatherIdx) => {
          const itemOrder = day.items.map((i) => ({ id: i.id, sortOrder: i.sortOrder }));
          const dayIdx = dayOrder.findIndex((d) => d.id === day.id);
          const isLastDay = dayIdx === dayOrder.length - 1;

          return (
            <div
              key={day.id}
              className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:break-inside-avoid print:shadow-none print:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold capitalize text-gray-900 dark:text-gray-100">
                  {formatDateLong(day.date)}
                  <WeatherBadge weather={dayWeather[dayWeatherIdx]} />
                </h3>
                <div className="flex items-center gap-2 print:hidden">
                  <ReorderButtons
                    disableUp={dayIdx === 0}
                    disableDown={dayIdx === dayOrder.length - 1}
                    onMoveUp={moveDayAction.bind(null, trip.id, dayOrder, day.id, "up")}
                    onMoveDown={moveDayAction.bind(null, trip.id, dayOrder, day.id, "down")}
                  />
                  <DayFormDialog
                    day={day}
                    trigger={
                      <button className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">✏️</button>
                    }
                    onSubmit={editDayAction.bind(null, trip.id, day.id)}
                    onDelete={deleteDayAction.bind(null, trip.id, day.id)}
                    onUndoDelete={restoreDayAction.bind(null, trip.id, day.id)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                {day.items.map((item) => {
                  const meta = itemTypeMeta[item.type];
                  const itemIdx = itemOrder.findIndex((i) => i.id === item.id);
                  const tzLabel = getApproxUtcOffsetLabel(item.lat, item.lng);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-start print:break-inside-avoid dark:border-gray-800"
                    >
                      <span className={`w-fit rounded-full px-2 py-1 text-lg ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-gray-100">{item.title}</span>
                          {item.startTime && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                              {item.startTime}
                              {tzLabel && ` · ${tzLabel}`}
                            </span>
                          )}
                          {item.type === "flight" && (
                            <FlightStatusBadge title={item.title} />
                          )}
                        </div>
                        {item.location && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">{item.location}</p>
                        )}
                        {item.cost !== undefined && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">Costo: {formatCost(item.cost, trip.currency)}</p>
                        )}
                        {item.confirmationCode && (
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            Confirmación: {item.confirmationCode}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-start print:hidden">
                        <ReorderButtons
                          disableUp={itemIdx === 0}
                          disableDown={itemIdx === itemOrder.length - 1}
                          onMoveUp={moveItemAction.bind(null, trip.id, itemOrder, item.id, "up")}
                          onMoveDown={moveItemAction.bind(null, trip.id, itemOrder, item.id, "down")}
                        />
                        <ItemFormDialog
                          item={item}
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
                      </div>
                    </div>
                  );
                })}

                <ItemFormDialog
                  trigger={
                    <button
                      id={isLastDay ? ADD_ITEM_LAST_DAY_TRIGGER_ID : undefined}
                      className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:bg-gray-50 print:hidden dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                    >
                      + Agregar item
                    </button>
                  }
                  onSubmit={addItemAction.bind(null, trip.id, day.id)}
                />
              </div>
            </div>
          );
        })}

        <DayFormDialog
          trigger={
            <button
              id={ADD_DAY_TRIGGER_ID}
              className="w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:bg-gray-50 print:hidden dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              + Agregar día
            </button>
          }
          onSubmit={addDayAction.bind(null, trip.id)}
        />
      </div>

      {feedback.length > 0 && (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:hidden dark:border-gray-800 dark:bg-gray-900">
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
        </div>
      )}

      <TripEditorShortcuts />
      <UndoToastHost />
    </main>
  );
}


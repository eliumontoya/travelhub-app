import { DayFormDialog } from "@/components/DayFormDialog";
import { DuplicateItemDialog } from "@/components/DuplicateItemDialog";
import { FlightStatusBadge } from "@/components/FlightStatusBadge";
import { ItemFormDialog } from "@/components/ItemFormDialog";
import { ItemTypeIcon } from "@/components/ItemTypeIcon";
import { LocationActions } from "@/components/LocationMap";
import { MoveItemToDayDialog } from "@/components/MoveItemToDayDialog";
import { ReorderButtons } from "@/components/ReorderButtons";
import { WeatherBadge } from "@/components/WeatherBadge";
import { NoteHtml } from "@/components/NoteHtml";
import { getItemFlightNumber, formatItemMetadataSummary } from "@/lib/item-display";
import { itemTypeMeta, formatDateLong, formatCost } from "@/lib/item-meta";
import { resolveItemLocation } from "@/lib/item-location";
import { getApproxUtcOffsetLabel } from "@/lib/timezone";
import type { DayWeather } from "@/lib/weather";
import { ADD_ITEM_LAST_DAY_TRIGGER_ID } from "@/components/TripEditorShortcuts";
import type { ItemDocument, ItemWithSupplier, Supplier, TripWithDetails } from "@/types";

export interface DayCardActions {
  moveDay: (dayId: string, direction: "up" | "down") => Promise<void>;
  editDay: (dayId: string, formData: FormData) => Promise<void>;
  deleteDay: (dayId: string) => Promise<void>;
  restoreDay: (dayId: string) => Promise<void>;
  addItem: (dayId: string, formData: FormData) => Promise<void>;
  moveItem: (items: { id: string; sortOrder: number }[], itemId: string, direction: "up" | "down") => Promise<void>;
  moveItemToDay: (tripId: string, itemId: string, formData: FormData) => Promise<void>;
  editItem: (itemId: string, formData: FormData) => Promise<void>;
  deleteItem: (itemId: string) => Promise<void>;
  restoreItem: (itemId: string) => Promise<void>;
  duplicateItem: (itemId: string, targetDayId: string) => Promise<void>;
  getItemDocuments: (itemId: string) => Promise<(ItemDocument & { url: string | null })[]>;
  uploadDocument: (itemId: string, formData: FormData) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
}

export function DayCard({
  trip,
  day,
  dayIndex,
  isLastDay,
  weather,
  isEditable,
  allSuppliers,
  documentsEnabled,
  actions,
}: {
  trip: TripWithDetails;
  day: TripWithDetails["days"][number];
  dayIndex: number;
  isLastDay: boolean;
  weather: DayWeather | null;
  isEditable: boolean;
  allSuppliers: Supplier[];
  documentsEnabled: boolean;
  actions: DayCardActions;
}) {
  const itemOrder = day.items.map((i) => ({ id: i.id, sortOrder: i.sortOrder }));

  return (
    <div
      id={`day-${day.id}`}
      className="scroll-mt-6 rounded-2xl border border-[#e7c797] bg-[#fffdfb] p-4 shadow-[0_12px_30px_rgba(74,24,52,0.08)] sm:p-5 print:break-inside-avoid print:border-[var(--operator-border)] print:shadow-none dark:border-[#f0bd79]/25 dark:bg-[#2b1520]"
    >
      <div className="mb-4 flex flex-col gap-3 border-b border-[#f0bd79]/35 pb-4 sm:flex-row sm:items-start sm:justify-between print:border-b-0 print:pb-0">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#731044] dark:text-[#f0bd79]">Día {dayIndex + 1}</p>
          <h3 className="mt-1 flex flex-wrap items-center gap-2 font-semibold capitalize text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">
            {formatDateLong(day.date)}
            <WeatherBadge weather={weather} />
          </h3>
          <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
            {day.items.length === 0
              ? "Sin items todavía"
              : `${day.items.length} ${day.items.length === 1 ? "item configurado" : "items configurados"}`}
          </p>
        </div>
        {isEditable && (
        <div className="flex items-center gap-2 self-start print:hidden">
          <ReorderButtons
            disableUp={dayIndex === 0}
            disableDown={isLastDay}
            onMoveUp={actions.moveDay.bind(null, day.id, "up")}
            onMoveDown={actions.moveDay.bind(null, day.id, "down")}
          />
          <DayFormDialog
            day={day}
            trigger={
              <button className="rounded-lg border border-[var(--operator-border)] px-2.5 py-1.5 text-sm text-[var(--operator-ink-muted)] hover:bg-[var(--operator-canvas)] hover:text-[var(--operator-ink)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)] dark:hover:text-[var(--operator-brand)]">
                ✏️ Editar día
              </button>
            }
            onSubmit={actions.editDay.bind(null, day.id)}
            onDelete={actions.deleteDay.bind(null, day.id)}
            onUndoDelete={actions.restoreDay.bind(null, day.id)}
          />
        </div>
        )}
      </div>

      {day.notes && (
        <div className="mb-4 rounded-xl border border-dashed border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 print:border-[var(--operator-border)] print:bg-white dark:border-[var(--operator-border)] dark:bg-[var(--operator-surface-subtle)]/20">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--operator-gold)] dark:text-[var(--operator-gold)]">
            Nota del día
          </p>
          <NoteHtml html={day.notes} className="text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]" />
        </div>
      )}

      <div className="space-y-3">
        {day.items.length === 0 && (
          <div className="rounded-xl border border-dashed border-[var(--operator-gold)]/50 bg-[var(--operator-gold)]/15/70 p-4 text-sm text-[var(--operator-brand)] print:hidden dark:border-[var(--operator-gold)]/50 dark:bg-[var(--operator-gold)]/15/20 dark:text-[var(--operator-brand)]">
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
              className="group flex flex-col gap-3 rounded-xl border border-[#f0bd79]/35 bg-[#fff8f1] p-3 transition hover:border-[#b67a91] hover:bg-[#fffdfb] sm:flex-row sm:items-start print:break-inside-avoid print:bg-white dark:border-[#f0bd79]/20 dark:bg-[#321426] dark:hover:border-[#f0bd79]"
            >
              <ItemTypeIcon type={item.type} title={meta.label} className="h-10 w-10" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{item.title}</span>
                  {item.startTime && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--operator-ink-muted)] ring-1 ring-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:text-[var(--operator-ink-subtle)] dark:ring-[var(--operator-border)]">
                      {item.startTime}
                      {tzLabel && ` · ${tzLabel}`}
                    </span>
                  )}
                  {item.type === "flight" && (
                    <FlightStatusBadge flightNumber={getItemFlightNumber(item)} />
                  )}
                </div>
                {resolvedLocation && (
                  <p className="mt-1 text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">{resolvedLocation.label}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  {item.cost !== undefined && (
                    <p className="text-xs text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">Costo: {formatCost(item.cost, trip.currency)}</p>
                  )}
                  {item.confirmationCode && (
                    <p className="text-xs text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">
                      Confirmación: {item.confirmationCode}
                    </p>
                  )}
                </div>
                {formatItemMetadataSummary(item) && (
                  <p className={`mt-1 text-xs ${item.type === "flight" ? "font-medium text-[var(--operator-brand)] dark:text-[var(--operator-gold)]" : "text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]"}`}>
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
                  onMoveUp={actions.moveItem.bind(null, itemOrder, item.id, "up")}
                  onMoveDown={actions.moveItem.bind(null, itemOrder, item.id, "down")}
                />
                <MoveItemToDayDialog
                  tripId={trip.id}
                  itemId={item.id}
                  days={trip.days.map((d) => ({ id: d.id, date: d.date }))}
                  currentDayId={day.id}
                  onMove={actions.moveItemToDay}
                  trigger={
                    <button
                      type="button"
                      className="text-sm text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-muted)] dark:hover:text-[var(--operator-ink-subtle)]"
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
                    <button className="text-sm text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-muted)] dark:hover:text-[var(--operator-ink-subtle)]">
                      ✏️
                    </button>
                  }
                  onSubmit={actions.editItem.bind(null, item.id)}
                  onDelete={actions.deleteItem.bind(null, item.id)}
                  onUndoDelete={actions.restoreItem.bind(null, item.id)}
                  documentsEnabled={documentsEnabled}
                  onLoadDocuments={actions.getItemDocuments.bind(null, item.id)}
                  onUploadDocument={actions.uploadDocument.bind(null, item.id)}
                  onDeleteDocument={actions.deleteDocument}
                />
                <DuplicateItemDialog
                  itemTitle={item.title}
                  days={trip.days.map((d) => ({ id: d.id, date: d.date }))}
                  sourceDayId={day.id}
                  onDuplicate={actions.duplicateItem.bind(null, item.id)}
                  trigger={
                    <button
                      type="button"
                      title="Duplicar en otro día"
                      className="text-sm text-[var(--operator-ink-subtle)] hover:text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-muted)] dark:hover:text-[var(--operator-ink-subtle)]"
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
              className="w-full rounded-xl border border-dashed border-[#b67a91] py-3 text-sm font-semibold text-[#731044] transition hover:bg-[#f8e7e7] print:hidden dark:border-[#f0bd79]/45 dark:text-[#f0bd79] dark:hover:bg-[#5c123e]"
            >
              + Agregar item a este día
            </button>
          }
          onSubmit={actions.addItem.bind(null, day.id)}
        />
        )}
      </div>
    </div>
  );
}

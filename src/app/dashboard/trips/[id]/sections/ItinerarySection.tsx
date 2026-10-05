import { DayFormDialog } from "@/components/DayFormDialog";
import { GenerateDaysButton } from "@/components/GenerateDaysButton";
import type { DayWeather } from "@/lib/weather";
import type { Supplier, TripWithDetails } from "@/types";
import { DayCard, type DayCardActions } from "./DayCard";

export function ItinerarySection({
  trip,
  isEditable,
  dayOrder,
  dayWeather,
  tripDateRangeDays,
  allSuppliers,
  documentsEnabled,
  actions,
  onAddDay,
  onGenerateDays,
}: {
  trip: TripWithDetails;
  isEditable: boolean;
  dayOrder: { id: string; sortOrder: number }[];
  dayWeather: (DayWeather | null)[];
  tripDateRangeDays: number | null;
  allSuppliers: Supplier[];
  documentsEnabled: boolean;
  actions: DayCardActions;
  onAddDay: (formData: FormData) => Promise<void>;
  onGenerateDays: () => Promise<{ ok: boolean; message: string }>;
}) {
  return (
    <section className="min-w-0 space-y-5 print:space-y-3">
      <div className="rounded-xl border border-[#e7c797] bg-[#fff3e5] p-4 print:hidden dark:border-[#f0bd79]/25 dark:bg-[#3a1c25]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#4a1834] dark:text-[#fffdfb]">Itinerario por días</h2>
            <p className="text-sm text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">
              Configura las fechas e items del viaje desde esta línea de tiempo.
            </p>
          </div>
          {trip.days.length > 0 && (
            <a
              href={`#day-${trip.days[trip.days.length - 1].id}`}
              className="rounded-lg bg-[#731044] px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(92,18,62,0.25)] transition hover:bg-[#5c123e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0bd79]"
            >
              Ir al último día
            </a>
          )}
        </div>
      </div>

      {trip.days.map((day, dayWeatherIdx) => {
        const dayIdx = dayOrder.findIndex((d) => d.id === day.id);
        const isLastDay = dayIdx === dayOrder.length - 1;

        return (
          <DayCard
            key={day.id}
            trip={trip}
            day={day}
            dayIndex={dayIdx}
            isLastDay={isLastDay}
            weather={dayWeather[dayWeatherIdx]}
            isEditable={isEditable}
            allSuppliers={allSuppliers}
            documentsEnabled={documentsEnabled}
            actions={actions}
          />
        );
      })}

      {isEditable && (
      <div className="flex flex-col gap-2 sm:flex-row lg:hidden print:hidden">
        <DayFormDialog
          trigger={
            <button
              className="w-full rounded-lg border border-dashed border-[var(--operator-border)] py-3 text-sm text-[var(--operator-ink-muted)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
            >
              + Agregar día
            </button>
          }
          onSubmit={onAddDay}
        />
        {tripDateRangeDays !== null && (
          <GenerateDaysButton
            totalDays={tripDateRangeDays}
            onGenerate={onGenerateDays}
          />
        )}
      </div>
      )}
    </section>
  );
}

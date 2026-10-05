import { DayFormDialog } from "@/components/DayFormDialog";
import { GenerateDaysButton } from "@/components/GenerateDaysButton";
import { ADD_DAY_TRIGGER_ID } from "@/components/TripEditorShortcuts";
import { formatDateLong } from "@/lib/item-meta";
import type { TripWithDetails } from "@/types";

export function DaysNavSection({
  trip,
  isEditable,
  tripDateRangeDays,
  onAddDay,
  onGenerateDays,
}: {
  trip: TripWithDetails;
  isEditable: boolean;
  tripDateRangeDays: number | null;
  onAddDay: (formData: FormData) => Promise<void>;
  onGenerateDays: () => Promise<{ ok: boolean; message: string }>;
}) {
  return (
    <aside className="print:hidden">
      <div className="sticky top-4 rounded-xl border border-[#e7c797] bg-[#fffdfb] p-3 shadow-[0_12px_30px_rgba(74,24,52,0.08)] dark:border-[#f0bd79]/25 dark:bg-[#2b1520]">
        <p className="px-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#731044] dark:text-[#f0bd79]">Días del viaje</p>
        <nav className="mt-3 space-y-1">
          {trip.days.map((day, idx) => (
            <a
              key={day.id}
              href={`#day-${day.id}`}
              className="group flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-[#5c123e] transition hover:bg-[#f8e7e7] hover:text-[#731044] dark:text-[#f7dfbc] dark:hover:bg-[#5c123e]"
            >
              <span className="min-w-0">
                <span className="block text-xs font-medium text-[#9b6479] group-hover:text-[#731044]">Día {idx + 1}</span>
                <span className="block truncate font-medium capitalize">{formatDateLong(day.date)}</span>
              </span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${day.items.length === 0 ? "bg-[var(--operator-gold)]/15 text-[var(--operator-brand)] dark:bg-[var(--operator-gold)]/15 dark:text-[var(--operator-brand)]" : "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)] dark:bg-[var(--operator-brand)] dark:text-[var(--operator-ink-subtle)]"}`}>
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
                className="w-full rounded-lg border border-dashed border-[#b67a91] py-2 text-sm font-semibold text-[#731044] transition hover:bg-[#f8e7e7] dark:border-[#f0bd79]/45 dark:text-[#f0bd79] dark:hover:bg-[#5c123e]"
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
      </div>
    </aside>
  );
}

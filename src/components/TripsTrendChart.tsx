import { MonthlyTripCount } from "@/lib/data";

const MIN_BAR_HEIGHT_PX = 4;
const MAX_BAR_HEIGHT_PX = 120;

export function TripsTrendChart({ data }: { data: MonthlyTripCount[] }) {
  const max = Math.max(1, ...data.map((m) => m.count));

  return (
    <div className="rounded-xl border border-[var(--operator-border)] bg-white p-5 shadow-sm dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
      <h2 className="mb-4 text-sm font-medium text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">Viajes creados por mes</h2>
      <div className="flex items-end justify-between gap-2">
        {data.map((month) => {
          const height =
            month.count === 0
              ? MIN_BAR_HEIGHT_PX
              : Math.max(MIN_BAR_HEIGHT_PX, (month.count / max) * MAX_BAR_HEIGHT_PX);
          return (
            <div key={month.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]">{month.count}</span>
              <div
                className="w-full max-w-10 rounded-t-md bg-[var(--operator-brand)] dark:bg-[var(--operator-surface-subtle)]0"
                style={{ height: `${height}px` }}
              />
              <span className="text-xs text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]">{month.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

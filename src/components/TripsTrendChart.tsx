import { MonthlyTripCount } from "@/lib/data";

const MIN_BAR_HEIGHT_PX = 4;
const MAX_BAR_HEIGHT_PX = 120;

export function TripsTrendChart({ data }: { data: MonthlyTripCount[] }) {
  const max = Math.max(1, ...data.map((m) => m.count));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-medium text-gray-500">Viajes creados por mes</h2>
      <div className="flex items-end justify-between gap-2">
        {data.map((month) => {
          const height =
            month.count === 0
              ? MIN_BAR_HEIGHT_PX
              : Math.max(MIN_BAR_HEIGHT_PX, (month.count / max) * MAX_BAR_HEIGHT_PX);
          return (
            <div key={month.label} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-medium text-gray-700">{month.count}</span>
              <div
                className="w-full max-w-10 rounded-t-md bg-blue-600"
                style={{ height: `${height}px` }}
              />
              <span className="text-xs text-gray-400">{month.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

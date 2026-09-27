import type { DayWeather } from "@/lib/weather";

export function WeatherBadge({ weather }: { weather: DayWeather | null }) {
  if (!weather) return null;

  return (
    <span
      title={weather.label}
      className="inline-flex items-center gap-1 rounded-full bg-[var(--operator-surface-subtle)] px-2 py-0.5 text-xs font-normal text-[var(--operator-ink-muted)]"
    >
      {weather.icon} {weather.tempMax}°/{weather.tempMin}°
    </span>
  );
}

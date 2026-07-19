export interface DayWeather {
  icon: string;
  label: string;
  tempMax: number;
  tempMin: number;
}

const WMO_CODE_META: Record<number, { icon: string; label: string }> = {
  0: { icon: "☀️", label: "Despejado" },
  1: { icon: "🌤️", label: "Mayormente despejado" },
  2: { icon: "⛅", label: "Parcialmente nublado" },
  3: { icon: "☁️", label: "Nublado" },
  45: { icon: "🌫️", label: "Neblina" },
  48: { icon: "🌫️", label: "Neblina con escarcha" },
  51: { icon: "🌦️", label: "Llovizna ligera" },
  53: { icon: "🌦️", label: "Llovizna" },
  55: { icon: "🌧️", label: "Llovizna intensa" },
  56: { icon: "🌧️", label: "Llovizna helada" },
  57: { icon: "🌧️", label: "Llovizna helada intensa" },
  61: { icon: "🌦️", label: "Lluvia ligera" },
  63: { icon: "🌧️", label: "Lluvia" },
  65: { icon: "🌧️", label: "Lluvia intensa" },
  66: { icon: "🌧️", label: "Lluvia helada" },
  67: { icon: "🌧️", label: "Lluvia helada intensa" },
  71: { icon: "🌨️", label: "Nieve ligera" },
  73: { icon: "🌨️", label: "Nieve" },
  75: { icon: "❄️", label: "Nieve intensa" },
  77: { icon: "❄️", label: "Granos de nieve" },
  80: { icon: "🌦️", label: "Chubascos ligeros" },
  81: { icon: "🌧️", label: "Chubascos" },
  82: { icon: "⛈️", label: "Chubascos violentos" },
  85: { icon: "🌨️", label: "Chubascos de nieve ligeros" },
  86: { icon: "🌨️", label: "Chubascos de nieve" },
  95: { icon: "⛈️", label: "Tormenta" },
  96: { icon: "⛈️", label: "Tormenta con granizo" },
  99: { icon: "⛈️", label: "Tormenta con granizo fuerte" },
};

function weatherCodeMeta(code: number) {
  return WMO_CODE_META[code] ?? { icon: "🌡️", label: "Clima" };
}

export async function getDailyWeather(
  lat: number | undefined,
  lng: number | undefined,
  date: string | undefined
): Promise<DayWeather | null> {
  if (lat === undefined || lng === undefined || !date) return null;

  const day = date.slice(0, 10);
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date=${day}&end_date=${day}`;

  try {
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const data = await res.json();
    const code = data?.daily?.weathercode?.[0];
    const tempMax = data?.daily?.temperature_2m_max?.[0];
    const tempMin = data?.daily?.temperature_2m_min?.[0];

    if (
      typeof code !== "number" ||
      typeof tempMax !== "number" ||
      typeof tempMin !== "number"
    ) {
      return null;
    }

    const meta = weatherCodeMeta(code);
    return { icon: meta.icon, label: meta.label, tempMax: Math.round(tempMax), tempMin: Math.round(tempMin) };
  } catch {
    return null;
  }
}

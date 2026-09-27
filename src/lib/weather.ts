export interface DayWeather {
  icon: string;
  label: string;
  tempMax: number;
  tempMin: number;
}

const WMO_CODE_META: Record<number, { icon: string; label: string }> = {
  0: { icon: "SOL", label: "Despejado" },
  1: { icon: "SOL", label: "Mayormente despejado" },
  2: { icon: "NUB", label: "Parcialmente nublado" },
  3: { icon: "NUB", label: "Nublado" },
  45: { icon: "NEB", label: "Neblina" },
  48: { icon: "NEB", label: "Neblina con escarcha" },
  51: { icon: "LL", label: "Llovizna ligera" },
  53: { icon: "LL", label: "Llovizna" },
  55: { icon: "LL", label: "Llovizna intensa" },
  56: { icon: "LL", label: "Llovizna helada" },
  57: { icon: "LL", label: "Llovizna helada intensa" },
  61: { icon: "LL", label: "Lluvia ligera" },
  63: { icon: "LL", label: "Lluvia" },
  65: { icon: "LL", label: "Lluvia intensa" },
  66: { icon: "LL", label: "Lluvia helada" },
  67: { icon: "LL", label: "Lluvia helada intensa" },
  71: { icon: "NV", label: "Nieve ligera" },
  73: { icon: "NV", label: "Nieve" },
  75: { icon: "NV", label: "Nieve intensa" },
  77: { icon: "NV", label: "Granos de nieve" },
  80: { icon: "LL", label: "Chubascos ligeros" },
  81: { icon: "LL", label: "Chubascos" },
  82: { icon: "TR", label: "Chubascos violentos" },
  85: { icon: "NV", label: "Chubascos de nieve ligeros" },
  86: { icon: "NV", label: "Chubascos de nieve" },
  95: { icon: "TR", label: "Tormenta" },
  96: { icon: "TR", label: "Tormenta con granizo" },
  99: { icon: "TR", label: "Tormenta con granizo fuerte" },
};

function weatherCodeMeta(code: number) {
  return WMO_CODE_META[code] ?? { icon: "CL", label: "Clima" };
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

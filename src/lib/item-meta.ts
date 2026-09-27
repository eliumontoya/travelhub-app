import { Client, ItemType, Tag, TripCurrency, TripWithDetails } from "@/types";
import { DEFAULT_LANG, Lang, localeFor } from "@/lib/i18n";

// label es fijo en español: se usa en el dashboard interno (fuera del alcance
// del toggle ES/EN de la vista pública /t/[slug]).
export const itemTypeMeta: Record<ItemType, { label: string; icon: string; color: string }> = {
  flight: { label: "Vuelo", icon: "AV", color: "bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]" },
  hotel: { label: "Hotel", icon: "H", color: "bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]" },
  activity: { label: "Actividad", icon: "AC", color: "bg-[#fff8e8] text-[#b76700]" },
  restaurant: { label: "Restaurante", icon: "R", color: "bg-[#fff0eb] text-[var(--operator-coral)]" },
  transport: { label: "Transporte", icon: "T", color: "bg-[var(--operator-surface-subtle)] text-[var(--operator-brand)]" },
  note: { label: "Nota", icon: "N", color: "bg-white text-[var(--operator-ink-muted)]" },
};

export const REFERRAL_SOURCE_OPTIONS = [
  "Referido",
  "Redes sociales",
  "Recurrente",
  "Búsqueda web",
  "Otro",
] as const;

export const currencyMeta: Record<TripCurrency, { label: string; locale: string }> = {
  MXN: { label: "MXN — Peso mexicano", locale: "es-MX" },
  USD: { label: "USD — Dólar estadounidense", locale: "en-US" },
  EUR: { label: "EUR — Euro", locale: "es-ES" },
};

export function formatDateLong(dateStr: string, lang: Lang = DEFAULT_LANG) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(localeFor(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateStr: string, lang: Lang = DEFAULT_LANG) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(localeFor(lang), {
    day: "numeric",
    month: "short",
  });
}

// Timestamp legible para entradas del historial de status del viaje (issue
// #55): siempre es-MX, sin depender del toggle ES/EN de la vista pública.
export function formatDateTime(isoStr: string) {
  return new Date(isoStr).toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateCompact(dateStr: string, lang: Lang = DEFAULT_LANG) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString(localeFor(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Separa palabras compuestas por " & " o " y " en una lista de palabras
// individuales. Si una palabra aparece varias veces, se conserva una sola.
function splitName(name: string): string[] {
  return name
    .split(/\s+[&yY]\s+/)
    .flatMap((part) => part.split(/\s+y\s+/i))
    .map((s) => s.trim())
    .filter(Boolean);
}

// Normaliza una lista de clientes separando nombres compuestos y
// deduplicando palabras individuales. Esto corrige el caso en que un
// cliente se llama "Ana & Pedro" y otro "Ana" — en lugar de mostrar
// "Ana & Pedro, Ana", muestra "Ana, Pedro".
export function normalizeClientNames(clients: Client[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const c of clients) {
    for (const word of splitName(c.name)) {
      if (!seen.has(word)) {
        seen.add(word);
        result.push(word);
      }
    }
  }
  return result;
}

// Formato es-MX para listas de clientes asignados a un viaje: hasta 2
// nombres se muestran completos separados por coma; a partir de 3, se
// muestran los primeros 2 + "+N más" (N = total - 2).
// Ej.: ["Ana", "Luis"] -> "Ana, Luis"; ["Ana","Luis","Carla","Diego"] ->
// "Ana, Luis +2 más".
//
// Internamente aplica normalizeClientNames para evitar duplicados cuando
// hay nombres compuestos como "Ana & Pedro" junto a "Ana".
export function formatAssignedClients(clients: Client[]): string {
  const names = normalizeClientNames(clients);
  if (names.length === 0) return "";
  if (names.length <= 2) return names.join(", ");
  const [first, second] = names;
  const remaining = names.length - 2;
  return `${first}, ${second} +${remaining} más`;
}

// Nombres de tags listos para render como chips (el componente que consuma
// esto decide el markup; aquí solo se normaliza el orden/lista).
export function formatTags(tags: Tag[]): string[] {
  return tags.map((t) => t.name);
}

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: "year", seconds: 31536000 },
  { unit: "month", seconds: 2592000 },
  { unit: "day", seconds: 86400 },
  { unit: "hour", seconds: 3600 },
  { unit: "minute", seconds: 60 },
];

const relativeTimeFormatter = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

// Timestamp relativo tipo "hace 2 horas" para el feed de actividad reciente
// del dashboard (issue #36). Usa Intl.RelativeTimeFormat en vez de armar el
// string a mano para heredar pluralización/gramática de es-MX gratis.
export function formatRelativeTime(isoTimestamp: string): string {
  const diffSeconds = (Date.parse(isoTimestamp) - Date.now()) / 1000;
  if (Math.abs(diffSeconds) < 60) return "justo ahora";

  for (const { unit, seconds } of RELATIVE_TIME_UNITS) {
    if (Math.abs(diffSeconds) >= seconds) {
      return relativeTimeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return relativeTimeFormatter.format(Math.round(diffSeconds / 60), "minute");
}

export interface TripCompleteness {
  totalItems: number;
  itemsWithDocuments: number;
  /** 0-100, redondeado. 100 cuando no hay items (nada pendiente que documentar). */
  documentPercentage: number;
  /** Días con cero items, en el orden en que aparecen en trip.days. */
  emptyDays: { id: string; date: string }[];
}

// Indicador de completitud para el editor de viajes: % de items con al
// menos 1 documento adjunto + lista de días sin ningún item. Se calcula en
// memoria a partir de trip.days/items/documents ya cargados por
// getTripById; no dispara queries adicionales ni requiere nuevas tablas.
export function computeTripCompleteness(trip: TripWithDetails): TripCompleteness {
  const allItems = trip.days.flatMap((day) => day.items);
  const totalItems = allItems.length;
  const itemsWithDocuments = allItems.filter((item) => (item.documents?.length ?? 0) > 0).length;
  const documentPercentage =
    totalItems === 0 ? 100 : Math.round((itemsWithDocuments / totalItems) * 100);
  const emptyDays = trip.days
    .filter((day) => day.items.length === 0)
    .map((day) => ({ id: day.id, date: day.date }));

  return { totalItems, itemsWithDocuments, documentPercentage, emptyDays };
}

// Formato de moneda para el resumen de costos (issue #35, extendido por
// issue #44 con soporte multi-moneda). Sin conversión de tipo de cambio:
// solo aplica el símbolo/locale de la moneda del viaje elegida.
// `currency` es opcional y cae a "MXN" para datos mock/antiguos sin el campo.
export function formatCost(value: number, currency: TripCurrency = "MXN"): string {
  return new Intl.NumberFormat(currencyMeta[currency].locale, {
    style: "currency",
    currency,
  }).format(value);
}

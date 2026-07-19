import { Client, ItemType, Tag } from "@/types";

export const itemTypeMeta: Record<ItemType, { label: string; icon: string; color: string }> = {
  flight: { label: "Vuelo", icon: "✈️", color: "bg-sky-100 text-sky-700" },
  hotel: { label: "Hotel", icon: "🏨", color: "bg-purple-100 text-purple-700" },
  activity: { label: "Actividad", icon: "🎟️", color: "bg-amber-100 text-amber-700" },
  restaurant: { label: "Restaurante", icon: "🍽️", color: "bg-rose-100 text-rose-700" },
  transport: { label: "Transporte", icon: "🚗", color: "bg-emerald-100 text-emerald-700" },
  note: { label: "Nota", icon: "📝", color: "bg-gray-100 text-gray-700" },
};

export function formatDateLong(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateShort(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}

export function formatDateCompact(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("es-MX", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Formato es-MX para listas de clientes asignados a un viaje: hasta 2
// nombres se muestran completos separados por coma; a partir de 3, se
// muestran los primeros 2 + "+N más" (N = total - 2).
// Ej.: ["Ana", "Luis"] -> "Ana, Luis"; ["Ana","Luis","Carla","Diego"] ->
// "Ana, Luis +2 más".
export function formatAssignedClients(clients: Client[]): string {
  if (clients.length === 0) return "";
  if (clients.length <= 2) return clients.map((c) => c.name).join(", ");
  const [first, second] = clients;
  const remaining = clients.length - 2;
  return `${first.name}, ${second.name} +${remaining} más`;
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

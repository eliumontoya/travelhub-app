import { Client, ItemType, Tag, TripCurrency } from "@/types";

export const itemTypeMeta: Record<ItemType, { label: string; icon: string; color: string }> = {
  flight: { label: "Vuelo", icon: "✈️", color: "bg-sky-100 text-sky-700" },
  hotel: { label: "Hotel", icon: "🏨", color: "bg-purple-100 text-purple-700" },
  activity: { label: "Actividad", icon: "🎟️", color: "bg-amber-100 text-amber-700" },
  restaurant: { label: "Restaurante", icon: "🍽️", color: "bg-rose-100 text-rose-700" },
  transport: { label: "Transporte", icon: "🚗", color: "bg-emerald-100 text-emerald-700" },
  note: { label: "Nota", icon: "📝", color: "bg-gray-100 text-gray-700" },
};

export const currencyMeta: Record<TripCurrency, { label: string; locale: string }> = {
  MXN: { label: "MXN — Peso mexicano", locale: "es-MX" },
  USD: { label: "USD — Dólar estadounidense", locale: "en-US" },
  EUR: { label: "EUR — Euro", locale: "es-ES" },
};

// Sin conversión de tipo de cambio (fuera de alcance, issue #44): formatea el
// monto tal cual con el símbolo/locale de la moneda elegida por el viaje.
export function formatCurrency(amount: number, currency: TripCurrency): string {
  return new Intl.NumberFormat(currencyMeta[currency].locale, {
    style: "currency",
    currency,
  }).format(amount);
}

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

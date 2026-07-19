import { Client, ItemType, Tag, TripWithDetails } from "@/types";

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

// Formato genérico de moneda para el resumen de costos (issue #35). Sin
// símbolo de divisa fijo en el dominio (la app no modela multi-moneda aún),
// por lo que se usa un formato numérico simple con separador de miles.
export function formatCost(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

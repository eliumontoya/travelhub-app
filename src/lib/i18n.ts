import { ItemType } from "@/types";

export type Lang = "es" | "en";

export const DEFAULT_LANG: Lang = "es";
export const LANG_QUERY_PARAM = "lang";
export const LANG_STORAGE_KEY = "travelhub-lang";

export const dictionary = {
  es: {
    calendarButton: "+ Calendario",
    addTripToCalendar: "📅 Agregar viaje completo a mi calendario",
    confirmationLabel: "Confirmación",
    daysNav: "Días del viaje",
    traveler: "viajero",
    travelers: "viajeros",
    itemType: {
      flight: "Vuelo",
      hotel: "Hotel",
      activity: "Actividad",
      restaurant: "Restaurante",
      transport: "Transporte",
      note: "Nota",
    } satisfies Record<ItemType, string>,
    packingList: "Checklist de equipaje",
  },
  en: {
    calendarButton: "+ Calendar",
    addTripToCalendar: "📅 Add full trip to my calendar",
    confirmationLabel: "Confirmation",
    daysNav: "Trip days",
    traveler: "traveler",
    travelers: "travelers",
    itemType: {
      flight: "Flight",
      hotel: "Hotel",
      activity: "Activity",
      restaurant: "Restaurant",
      transport: "Transport",
      note: "Note",
    } satisfies Record<ItemType, string>,
    packingList: "Packing checklist",
  },
} satisfies Record<Lang, unknown>;

export function isLang(value: string | undefined | null): value is Lang {
  return value === "es" || value === "en";
}

export function getLangFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>
): Lang | null {
  const raw = searchParams[LANG_QUERY_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return isLang(value) ? value : null;
}

export function localeFor(lang: Lang): string {
  return lang === "en" ? "en-US" : "es-MX";
}

"use client";

import { useEffect, useRef, useState } from "react";

export type SupplierPlaceSelection = {
  googlePlaceId: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

export type PlaceLike = {
  id?: string;
  displayName?: string | { text?: string };
  formattedAddress?: string;
  location?: { lat: () => number; lng: () => number } | { lat: number; lng: number };
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
};

type PlacePredictionLike = {
  placeId?: string;
  toPlace: () => PlaceLike;
};

type PlaceSelectEvent = Event & {
  placePrediction?: PlacePredictionLike;
};

type PlaceAutocompleteElementLike = HTMLElement & {
  placeholder?: string;
  includedPrimaryTypes?: string[];
};

export type GooglePlacesLibrary = {
  PlaceAutocompleteElement: new (opts?: Record<string, unknown>) => PlaceAutocompleteElementLike;
  Place?: {
    searchByText: (request: Record<string, unknown>) => Promise<{ places: PlaceLike[] }>;
  };
};

type GooglePlacesWindow = Window & {
  google?: {
    maps: {
      importLibrary?: (library: "places") => Promise<GooglePlacesLibrary>;
    };
  };
};

let placesScriptPromise: Promise<void> | null = null;

function getGoogleWindow(): GooglePlacesWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as GooglePlacesWindow;
}

export function loadGooglePlacesScript(apiKey: string): Promise<void> {
  const googleWindow = getGoogleWindow();
  if (googleWindow?.google?.maps?.importLibrary) return Promise.resolve();
  if (placesScriptPromise) return placesScriptPromise;
  placesScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Places"));
    document.head.appendChild(script);
  });
  return placesScriptPromise;
}

export function getDisplayName(displayName: PlaceLike["displayName"]): string | undefined {
  if (typeof displayName === "string") return displayName;
  return displayName?.text;
}

export function getCoordinate(
  location: PlaceLike["location"],
  key: "lat" | "lng"
): number | undefined {
  if (!location) return undefined;
  const value = location[key];
  return typeof value === "function" ? value() : value;
}

export function SupplierPlaceAutocomplete({
  onPlaceSelect,
}: {
  onPlaceSelect: (place: SupplierPlaceSelection) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"missing-key" | "loading" | "ready" | "error">(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "loading" : "missing-key"
  );
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    setStatus("loading");
    container.replaceChildren();

    loadGooglePlacesScript(apiKey)
      .then(async () => {
        const googleWindow = getGoogleWindow();
        const placesLibrary = await googleWindow?.google?.maps.importLibrary?.("places");
        if (cancelled || !container || !placesLibrary?.PlaceAutocompleteElement) return;

        const autocompleteElement = new placesLibrary.PlaceAutocompleteElement({
          includedPrimaryTypes: ["establishment"],
        });
        autocompleteElement.placeholder = "Hotel, aeropuerto, restaurante…";
        autocompleteElement.className = "block w-full";
        autocompleteElement.addEventListener("gmp-select", async (event) => {
          const placePrediction = (event as PlaceSelectEvent).placePrediction;
          if (!placePrediction) return;
          const place = placePrediction.toPlace();
          await place.fetchFields({
            fields: ["id", "displayName", "formattedAddress", "location"],
          });
          const googlePlaceId = place.id ?? placePrediction.placeId;
          if (!googlePlaceId) return;
          onPlaceSelect({
            googlePlaceId,
            name: getDisplayName(place.displayName),
            address: place.formattedAddress,
            lat: getCoordinate(place.location, "lat"),
            lng: getCoordinate(place.location, "lng"),
          });
        });

        container.replaceChildren(autocompleteElement);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      container.replaceChildren();
    };
  }, [apiKey, onPlaceSelect]);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <label className="block text-sm font-medium text-blue-950">Buscar en Google Places</label>
      {apiKey && status !== "error" ? (
        <div ref={containerRef} className="mt-1 [&_gmp-place-autocomplete]:w-full" />
      ) : (
        <input
          type="text"
          disabled
          className="mt-1 w-full rounded-lg border border-blue-200 bg-gray-100 px-3 py-2 text-sm text-gray-500"
          placeholder="Configura Google Places para buscar"
        />
      )}
      {status === "missing-key" && (
        <p className="mt-1 text-xs text-blue-800">
          Google Places no está configurado. Captura el proveedor manualmente.
        </p>
      )}
      {status === "loading" && (
        <p className="mt-1 text-xs text-blue-800">Cargando búsqueda de lugares…</p>
      )}
      {status === "ready" && (
        <p className="mt-1 text-xs text-blue-800">
          Selecciona un resultado para rellenar nombre, dirección y coordenadas.
        </p>
      )}
      {status === "error" && (
        <p className="mt-1 text-xs text-blue-800">
          Google Places no está disponible. Verifica que la key permita Maps JavaScript API y Places API (New), o captura el proveedor manualmente.
        </p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

export type SupplierPlaceSelection = {
  googlePlaceId: string;
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
};

type GooglePlace = {
  place_id?: string;
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

type GooglePlacesWindow = Window & {
  google?: {
    maps: {
      places: {
        Autocomplete: new (
          input: HTMLInputElement,
          opts?: Record<string, unknown>
        ) => {
          addListener: (event: string, handler: () => void) => void;
          getPlace: () => GooglePlace;
        };
      };
    };
  };
};

let placesScriptPromise: Promise<void> | null = null;

function getGoogleWindow(): GooglePlacesWindow | undefined {
  if (typeof window === "undefined") return undefined;
  return window as GooglePlacesWindow;
}

function loadGooglePlacesScript(apiKey: string): Promise<void> {
  const googleWindow = getGoogleWindow();
  if (googleWindow?.google?.maps?.places) return Promise.resolve();
  if (placesScriptPromise) return placesScriptPromise;
  placesScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar Google Places"));
    document.head.appendChild(script);
  });
  return placesScriptPromise;
}

export function SupplierPlaceAutocomplete({
  onPlaceSelect,
}: {
  onPlaceSelect: (place: SupplierPlaceSelection) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"missing-key" | "loading" | "ready" | "error">(
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "loading" : "missing-key"
  );
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;
    setStatus("loading");

    loadGooglePlacesScript(apiKey)
      .then(() => {
        const googleWindow = getGoogleWindow();
        if (cancelled || !inputRef.current || !googleWindow?.google) return;
        const autocomplete = new googleWindow.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["place_id", "name", "formatted_address", "geometry"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace() as GooglePlace;
          const location = place.geometry?.location;
          if (!place.place_id) return;
          onPlaceSelect({
            googlePlaceId: place.place_id,
            name: place.name,
            address: place.formatted_address,
            lat: location?.lat(),
            lng: location?.lng(),
          });
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, onPlaceSelect]);

  return (
    <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
      <label htmlFor="supplier-place-search" className="block text-sm font-medium text-blue-950">
        Buscar en Google Places
      </label>
      <input
        ref={inputRef}
        id="supplier-place-search"
        type="text"
        disabled={!apiKey || status === "error"}
        className="mt-1 w-full rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm disabled:bg-gray-100 disabled:text-gray-500"
        placeholder={apiKey ? "Hotel, aeropuerto, restaurante…" : "Configura Google Places para buscar"}
      />
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
          Google Places no está disponible. Puedes capturar el proveedor manualmente.
        </p>
      )}
    </div>
  );
}

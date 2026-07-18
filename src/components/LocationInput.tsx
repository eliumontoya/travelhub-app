"use client";

import { useEffect, useRef, useState } from "react";

// Google Places Autocomplete se carga dinámicamente vía <script> solo si
// hay API key configurada. Sin key, este es un <input type="text"> normal
// sin autocomplete ni lat/lng — la app sigue siendo 100% usable sin ella.

declare global {
  interface Window {
    google?: {
      maps: {
        places: {
          Autocomplete: new (
            input: HTMLInputElement,
            opts?: Record<string, unknown>
          ) => {
            addListener: (event: string, handler: () => void) => void;
            getPlace: () => {
              geometry?: { location?: { lat: () => number; lng: () => number } };
            };
          };
        };
      };
    };
  }
}

let placesScriptPromise: Promise<void> | null = null;

function loadGooglePlacesScript(apiKey: string): Promise<void> {
  if (typeof window !== "undefined" && window.google?.maps?.places) return Promise.resolve();
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

export function LocationInput({
  defaultValue,
  defaultLat,
  defaultLng,
}: {
  defaultValue?: string;
  defaultLat?: number;
  defaultLng?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [lat, setLat] = useState<number | undefined>(defaultLat);
  const [lng, setLng] = useState<number | undefined>(defaultLng);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  useEffect(() => {
    if (!apiKey || !inputRef.current) return;
    let cancelled = false;
    loadGooglePlacesScript(apiKey)
      .then(() => {
        if (cancelled || !inputRef.current || !window.google) return;
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ["geometry", "formatted_address", "name"],
        });
        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;
          if (location) {
            setLat(location.lat());
            setLng(location.lng());
          }
        });
      })
      .catch(() => {
        // Falla silenciosa: el input sigue funcionando como texto plano.
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return (
    <div>
      <input
        ref={inputRef}
        type="text"
        name="location"
        defaultValue={defaultValue}
        placeholder={apiKey ? "Buscar ubicación…" : undefined}
        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
      />
      <input type="hidden" name="lat" value={lat ?? ""} readOnly />
      <input type="hidden" name="lng" value={lng ?? ""} readOnly />
    </div>
  );
}

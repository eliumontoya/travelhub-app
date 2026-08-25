import { buildGoogleMapsUrl } from "@/lib/item-location";

type LocationProps = {
  lat?: number;
  lng?: number;
  label?: string;
  address?: string;
};

export function LocationActions({ lat, lng, label, address }: LocationProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsUrl = buildGoogleMapsUrl({ lat, lng, address });
  if (!mapsUrl) return null;

  const hasCoordinates = lat !== undefined && lng !== undefined;
  const embedSrc = hasCoordinates && apiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encodeURIComponent(`${lat},${lng}`)}`
    : null;

  return (
    <div className="mt-2 space-y-2">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        📍 Abrir en Google Maps
      </a>
      {embedSrc && (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
          <iframe
            title={label ?? address ?? "Mapa"}
            src={embedSrc}
            width="100%"
            height="200"
            style={{ border: 0 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </div>
  );
}

export function LocationMap({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  return <LocationActions lat={lat} lng={lng} label={label} />;
}

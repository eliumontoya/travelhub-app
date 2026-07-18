// Server component: si hay NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, embebe un iframe
// de Google Maps Embed API. Sin key, siempre funciona un link simple a
// Google Maps — ese es el default seguro que nunca depende de la API key.
export function LocationMap({ lat, lng, label }: { lat: number; lng: number; label?: string }) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;

  if (!apiKey) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm text-blue-600 hover:underline"
      >
        📍 Abrir en Google Maps
      </a>
    );
  }

  const embedSrc = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${lat},${lng}${
    label ? `(${encodeURIComponent(label)})` : ""
  }`;

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
      <iframe
        title={label ?? "Mapa"}
        src={embedSrc}
        width="100%"
        height="200"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}

import { buildGoogleMapsUrl } from "@/lib/item-location";

export function SupplierInfo({
  name,
  address,
  lat,
  lng,
}: {
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}) {
  const mapsUrl = buildGoogleMapsUrl({ address, lat, lng });
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-900">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Proveedor</p>
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{name}</p>
      {address && mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
        >
          {address}
        </a>
      )}
    </div>
  );
}

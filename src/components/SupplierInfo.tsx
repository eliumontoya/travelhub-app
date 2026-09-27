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
    <div className="mt-2 rounded-lg border border-[var(--operator-border)] bg-[var(--operator-canvas)] p-2 dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
      <p className="text-xs font-medium text-[var(--operator-ink-muted)] dark:text-[var(--operator-ink-subtle)]">Proveedor</p>
      <p className="text-sm font-medium text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">{name}</p>
      {address && mapsUrl && (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--operator-brand)] hover:underline dark:text-[var(--operator-gold)]"
        >
          {address}
        </a>
      )}
    </div>
  );
}

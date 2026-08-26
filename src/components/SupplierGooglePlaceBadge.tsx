export function SupplierGooglePlaceBadge({ googlePlaceId }: { googlePlaceId?: string }) {
  const placeId = googlePlaceId?.trim();
  if (!placeId) return null;

  return (
    <span
      aria-label="Proveedor encontrado con Google Maps"
      title={`ID de Google Maps: ${placeId}`}
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 shadow-sm dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-3.5 w-3.5"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 2a6 6 0 0 0-6 6c0 4.2 5.28 9.43 5.5 9.65a.7.7 0 0 0 1 0C10.72 17.43 16 12.2 16 8a6 6 0 0 0-6-6Zm0 8.25A2.25 2.25 0 1 1 10 5.75a2.25 2.25 0 0 1 0 4.5Z"
          clipRule="evenodd"
        />
      </svg>
      Verificado con Google Maps
    </span>
  );
}

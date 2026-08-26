export function SupplierGooglePlaceBadge({ googlePlaceId }: { googlePlaceId?: string }) {
  const placeId = googlePlaceId?.trim();
  if (!placeId) return null;

  return (
    <span
      aria-label="Proveedor encontrado con Google Maps"
      title={`ID de Google Maps: ${placeId}`}
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-emerald-600 dark:text-emerald-300"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="h-4 w-4"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M10 2a6 6 0 0 0-6 6c0 4.2 5.28 9.43 5.5 9.65a.7.7 0 0 0 1 0C10.72 17.43 16 12.2 16 8a6 6 0 0 0-6-6Zm0 8.25A2.25 2.25 0 1 1 10 5.75a2.25 2.25 0 0 1 0 4.5Z"
          clipRule="evenodd"
        />
      </svg>
    </span>
  );
}

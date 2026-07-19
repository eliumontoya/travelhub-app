"use client";

export default function PublicTripError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Algo salió mal</h1>
      <p className="text-sm text-gray-500">{error.message || "Ocurrió un error inesperado."}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Reintentar
      </button>
    </main>
  );
}

export default function TripPublicNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Itinerario no disponible</h1>
      <p className="text-sm text-gray-500">
        Este itinerario no existe o todavía no ha sido publicado.
      </p>
    </main>
  );
}

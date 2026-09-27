export default function TripPublicNotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--operator-canvas)] px-4 text-center">
      <h1 className="text-2xl font-bold text-[var(--operator-brand)]">Itinerario no disponible</h1>
      <p className="text-sm text-[var(--operator-ink-muted)]">
        Este itinerario no existe o todavía no ha sido publicado.
      </p>
    </main>
  );
}

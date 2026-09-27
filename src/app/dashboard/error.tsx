"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-[var(--operator-brand)]">Algo salió mal</h1>
      <p className="text-sm text-[var(--operator-ink-muted)]">{error.message || "Ocurrió un error inesperado."}</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)]"
      >
        Reintentar
      </button>
    </main>
  );
}

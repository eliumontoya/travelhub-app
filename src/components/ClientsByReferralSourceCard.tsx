export function ClientsByReferralSourceCard({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .map(([source, count]) => ({ label: source || "Sin especificar", count }))
    .sort((a, b) => b.count - a.count);
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  return (
    <div className="mt-8 rounded-xl border border-[var(--operator-border)] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[var(--operator-brand)]">Clientes por fuente de referido</h2>
      {total === 0 ? (
        <p className="mt-2 text-sm text-[var(--operator-ink-muted)]">Todavía no hay clientes registrados.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {entries.map(({ label, count }) => (
            <li
              key={label}
              className="flex items-center justify-between rounded-lg bg-[var(--operator-canvas)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--operator-ink)]">{label}</span>
              <span className="font-medium text-[var(--operator-brand)]">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

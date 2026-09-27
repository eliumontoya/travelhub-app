export default function WccContactsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-24 animate-pulse rounded-2xl border border-[var(--operator-border)] bg-white/94" />
      <div className="mt-6 space-y-3 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--operator-surface-subtle)]" />
        ))}
      </div>
    </main>
  );
}

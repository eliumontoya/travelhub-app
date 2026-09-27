export default function ClientDetailLoading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse px-4 py-8">
      <div className="h-4 w-16 rounded bg-[var(--operator-surface-subtle)]" />

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="h-7 w-48 rounded-lg bg-[var(--operator-border)]" />
          <div className="mt-2 h-3 w-40 rounded bg-[var(--operator-surface-subtle)]" />
          <div className="mt-2 h-3 w-24 rounded bg-[var(--operator-surface-subtle)]" />
        </div>
        <div className="h-9 w-56 rounded-lg bg-[var(--operator-border)]" />
      </div>

      <div className="mb-8 h-12 rounded-lg border border-[var(--operator-border)] bg-white p-4" />

      <div className="mb-4 h-5 w-20 rounded bg-[var(--operator-border)]" />
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-[var(--operator-border)] bg-white p-5 shadow-sm"
          >
            <div className="w-full">
              <div className="h-4 w-1/3 rounded bg-[var(--operator-border)]" />
              <div className="mt-2 h-3 w-1/4 rounded bg-[var(--operator-surface-subtle)]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

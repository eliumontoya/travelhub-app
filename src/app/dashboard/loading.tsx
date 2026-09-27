export default function DashboardLoading() {
  return (
    <main className="mx-auto max-w-4xl animate-pulse px-4 py-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="h-7 w-32 rounded-lg bg-[var(--operator-border)]" />
        <div className="h-9 w-32 rounded-lg bg-[var(--operator-border)]" />
      </div>

      <div className="grid gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-xl border border-[var(--operator-border)] bg-white p-5 shadow-sm"
          >
            <div className="w-full">
              <div className="h-4 w-1/3 rounded bg-[var(--operator-border)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--operator-surface-subtle)]" />
              <div className="mt-2 h-3 w-1/4 rounded bg-[var(--operator-surface-subtle)]" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 mb-4 h-5 w-24 rounded bg-[var(--operator-border)]" />
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-[var(--operator-border)] bg-white p-4">
            <div className="h-4 w-1/3 rounded bg-[var(--operator-border)]" />
            <div className="mt-2 h-3 w-1/2 rounded bg-[var(--operator-surface-subtle)]" />
          </div>
        ))}
      </div>
    </main>
  );
}

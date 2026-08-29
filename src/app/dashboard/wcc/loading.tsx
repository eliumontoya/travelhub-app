export default function WccLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
        ))}
      </div>
    </main>
  );
}

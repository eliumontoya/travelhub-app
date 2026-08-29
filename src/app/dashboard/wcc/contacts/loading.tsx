export default function WccContactsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-24 animate-pulse rounded-2xl border border-slate-800 bg-slate-900" />
      <div className="mt-6 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-5">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-800" />
        ))}
      </div>
    </main>
  );
}

export default function WccConversationsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-8 w-64 animate-pulse rounded bg-slate-800" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-900" />
        ))}
      </div>
    </main>
  );
}

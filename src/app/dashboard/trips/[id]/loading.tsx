export default function TripEditorLoading() {
  return (
    <main className="mx-auto max-w-3xl animate-pulse px-4 py-8">
      <div className="h-4 w-16 rounded bg-gray-100" />

      <div className="mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="h-7 w-48 rounded-lg bg-gray-200" />
          <div className="mt-2 h-3 w-32 rounded bg-gray-100" />
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-lg bg-gray-200" />
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, dayIdx) => (
          <div key={dayIdx} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div className="h-4 w-40 rounded bg-gray-200" />
              <div className="h-6 w-16 rounded bg-gray-100" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, itemIdx) => (
                <div
                  key={itemIdx}
                  className="flex flex-col gap-2 rounded-lg border border-gray-100 p-3 sm:flex-row sm:items-start"
                >
                  <div className="h-8 w-8 rounded-full bg-gray-100" />
                  <div className="flex-1">
                    <div className="h-4 w-1/3 rounded bg-gray-200" />
                    <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

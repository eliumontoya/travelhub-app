export default function PublicTripLoading() {
  return (
    <main className="min-h-screen animate-pulse bg-gray-50 pb-16">
      <div className="flex h-56 items-end bg-gray-800 sm:h-72">
        <div className="mx-auto w-full max-w-2xl px-4 pb-6">
          <div className="h-8 w-2/3 rounded-lg bg-white/20" />
          <div className="mt-2 h-3 w-1/3 rounded bg-white/20" />
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 lg:max-w-5xl lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-x-8">
        <div className="hidden lg:block lg:sticky lg:top-6 lg:self-start">
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-gray-200" />
            ))}
          </div>
        </div>

        <div className="lg:max-w-2xl">
          <div className="my-6 flex justify-center">
            <div className="h-9 w-40 rounded-lg bg-gray-200" />
          </div>

          <div className="space-y-8">
            {Array.from({ length: 2 }).map((_, dayIdx) => (
              <div key={dayIdx}>
                <div className="mb-3 h-5 w-40 rounded bg-gray-200" />
                <div className="space-y-3 border-l-2 border-gray-200 pl-4">
                  {Array.from({ length: 2 }).map((_, itemIdx) => (
                    <div
                      key={itemIdx}
                      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-100" />
                        <div className="flex-1">
                          <div className="h-4 w-1/3 rounded bg-gray-200" />
                          <div className="mt-2 h-3 w-1/2 rounded bg-gray-100" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

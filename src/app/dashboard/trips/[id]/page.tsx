import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripById } from "@/lib/mock-data";
import { itemTypeMeta, formatDateLong } from "@/lib/item-meta";

export default async function TripEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = getTripById(id);
  if (!trip) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/dashboard" className="text-sm text-gray-500 hover:underline">
        ← Volver
      </Link>

      <div className="mt-4 mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{trip.title}</h1>
          <p className="text-sm text-gray-500">{trip.client.name}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/t/${trip.slug}`}
            target="_blank"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Vista previa
          </Link>
          <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Copiar URL
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {trip.days.map((day) => (
          <div key={day.id} className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-4 font-semibold capitalize text-gray-900">
              {formatDateLong(day.date)}
            </h3>
            <div className="space-y-3">
              {day.items.map((item) => {
                const meta = itemTypeMeta[item.type];
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 rounded-lg border border-gray-100 p-3"
                  >
                    <span className={`rounded-full px-2 py-1 text-lg ${meta.color}`}>
                      {meta.icon}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{item.title}</span>
                        {item.startTime && (
                          <span className="text-xs text-gray-400">{item.startTime}</span>
                        )}
                      </div>
                      {item.location && (
                        <p className="text-sm text-gray-500">{item.location}</p>
                      )}
                      {item.confirmationCode && (
                        <p className="text-xs text-gray-400">
                          Confirmación: {item.confirmationCode}
                        </p>
                      )}
                    </div>
                    <button className="text-sm text-gray-400 hover:text-gray-600">✏️</button>
                  </div>
                );
              })}
              <button className="w-full rounded-lg border border-dashed border-gray-300 py-2 text-sm text-gray-500 hover:bg-gray-50">
                + Agregar item
              </button>
            </div>
          </div>
        ))}
        <button className="w-full rounded-lg border border-dashed border-gray-300 py-3 text-sm text-gray-500 hover:bg-gray-50">
          + Agregar día
        </button>
      </div>
    </main>
  );
}

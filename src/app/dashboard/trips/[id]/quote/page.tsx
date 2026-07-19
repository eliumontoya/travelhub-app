import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripById } from "@/lib/data";
import {
  itemTypeMeta,
  formatDateLong,
  formatAssignedClients,
  formatCurrency,
} from "@/lib/item-meta";
import { PrintButton } from "@/components/PrintButton";

export default async function TripQuotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trip = await getTripById(id);
  if (!trip) notFound();

  const days = trip.days.map((day) => {
    const subtotal = day.items.reduce((sum, item) => sum + (item.cost ?? 0), 0);
    return { ...day, subtotal };
  });
  const grandTotal = days.reduce((sum, day) => sum + day.subtotal, 0);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <Link
          href={`/dashboard/trips/${trip.id}`}
          className="text-sm text-gray-500 hover:underline"
        >
          ← Volver al viaje
        </Link>
        <PrintButton label="Imprimir cotización" />
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cotización — {trip.title}</h1>
        <p className="text-sm text-gray-500">{formatAssignedClients(trip.clients)}</p>
        {trip.startDate && trip.endDate && (
          <p className="mt-1 text-sm text-gray-500">
            {formatDateLong(trip.startDate)} – {formatDateLong(trip.endDate)}
          </p>
        )}
      </div>

      <div className="space-y-6 print:space-y-3">
        {days.map((day) => (
          <div
            key={day.id}
            className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 print:break-inside-avoid print:shadow-none print:border-gray-300"
          >
            <h3 className="mb-3 font-semibold capitalize text-gray-900">
              {formatDateLong(day.date)}
            </h3>

            {day.items.length === 0 ? (
              <p className="text-sm text-gray-400">Sin items este día.</p>
            ) : (
              <div className="space-y-2">
                {day.items.map((item) => {
                  const meta = itemTypeMeta[item.type];
                  return (
                    <div
                      key={item.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3 print:break-inside-avoid"
                    >
                      <div className="flex items-start gap-2">
                        <span className={`w-fit rounded-full px-2 py-1 text-lg ${meta.color}`}>
                          {meta.icon}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          {item.location && (
                            <p className="text-sm text-gray-500">{item.location}</p>
                          )}
                        </div>
                      </div>
                      <span className="shrink-0 font-medium text-gray-900">
                        {formatCurrency(item.cost ?? 0)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex justify-end border-t border-gray-100 pt-2 text-sm font-semibold text-gray-700">
              Subtotal del día: {formatCurrency(day.subtotal)}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-end border-t-2 border-gray-300 pt-4 text-lg font-bold text-gray-900">
        Total del viaje: {formatCurrency(grandTotal)}
      </div>
    </main>
  );
}

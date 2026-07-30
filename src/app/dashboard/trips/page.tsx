import Link from "next/link";

export default function TripsIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-center dark:border-gray-700 dark:bg-gray-900">
        <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Viajes</p>
        <h1 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">Viajes</h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          La sección dedicada de viajes se implementará en el issue #124. Por ahora esta ruta existe para que la navegación superior no apunte a una página inexistente.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Volver al dashboard
          </Link>
          <Link
            href="/dashboard/trips/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
          >
            + Nuevo viaje
          </Link>
        </div>
      </div>
    </main>
  );
}

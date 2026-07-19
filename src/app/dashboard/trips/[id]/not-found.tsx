import Link from "next/link";

export default function TripNotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Viaje no encontrado</h1>
      <p className="text-sm text-gray-500">
        Este viaje no existe o fue eliminado.
      </p>
      <Link
        href="/dashboard"
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Volver al dashboard
      </Link>
    </main>
  );
}

import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">TravelHub</h1>

      {!configured ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Supabase no está configurado todavía. Sigue los pasos de{" "}
          <code className="font-mono">SUPABASE_SETUP.md</code> para habilitar el login. Mientras
          tanto, el dashboard es accesible sin autenticación con datos de prueba.
        </p>
      ) : (
        <form action={signIn} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Contraseña</label>
            <input
              type="password"
              name="password"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Entrar
          </button>
        </form>
      )}
    </main>
  );
}

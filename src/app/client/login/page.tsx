import Image from "next/image";
import { clientSignIn } from "./actions";

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; redirectTo?: string }>;
}) {
  const { status, redirectTo } = await searchParams;

  const statusMessages: Record<string, string> = {
    success: "Has iniciado sesión correctamente.",
    invalid: "Email o PIN incorrectos.",
    rate_limited: "Demasiados intentos fallidos. Vuelve a intentarlo más tarde.",
    loggedOut: "Sesión cerrada correctamente.",
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-8">
      <div className="mb-8 flex flex-col items-center">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">HUBit by TravelHub</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">Acceso para clientes</p>
        <Image
          src="/logo.jpeg"
          alt="HUBit by TravelHub"
          width={182}
          height={128}
          priority
          className="mt-4 h-32 w-auto object-contain"
        />
      </div>

      {status && statusMessages[status] && (
        <p
          className={`mb-4 rounded-lg p-3 text-sm ${
            status === "success" || status === "loggedOut"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {statusMessages[status]}
        </p>
      )}

      <form action={clientSignIn} className="space-y-4">
        <input type="hidden" name="redirectTo" value={redirectTo ?? "/client/login?status=success"} />
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label htmlFor="pin" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            PIN
          </label>
          <input
            id="pin"
            type="password"
            name="pin"
            inputMode="numeric"
            pattern="[0-9]*"
            minLength={4}
            maxLength={6}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Ingresa el PIN de 4 a 6 dígitos que te proporcionó tu agente.
          </p>
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}

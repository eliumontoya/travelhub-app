import Image from "next/image";
import { OperatorButton } from "@/components/ui/OperatorButton";
import { OperatorSurface } from "@/components/ui/OperatorSurface";
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
  const isPositiveStatus = status === "success" || status === "loggedOut";

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--operator-canvas)] px-4 py-8 text-[var(--operator-ink)] sm:px-6">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-72 bg-[var(--operator-brand)]"
        data-testid="client-login-atmosphere"
      />
      <div
        aria-hidden="true"
        className="absolute -top-24 right-[-8rem] h-72 w-72 rounded-full bg-[var(--operator-accent)] opacity-35 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-10rem] left-[-6rem] h-72 w-72 rounded-full bg-[var(--operator-surface-subtle)] blur-3xl"
      />

      <OperatorSurface
        as="section"
        variant="panel"
        data-testid="client-login-panel"
        className="relative w-full max-w-md overflow-hidden p-6 sm:p-8"
        aria-labelledby="client-login-title"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="rounded-[var(--operator-radius-card)] bg-[var(--operator-surface)] px-5 py-3 shadow-[var(--operator-shadow-card)]">
            <Image
              src="/logo.jpeg"
              alt="HUBit by TravelHub"
              width={182}
              height={128}
              priority
              className="h-20 w-auto object-contain sm:h-24"
            />
          </div>
          <h1 id="client-login-title" className="mt-6 text-3xl font-semibold tracking-[-0.03em] text-[var(--operator-ink)]">
            Acceso para clientes
          </h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--operator-ink-muted)]">
            Consulta los detalles de tu viaje con los datos que te compartió tu agente.
          </p>
        </div>

        {status && statusMessages[status] && (
          <p
            role="status"
            aria-live="polite"
            className={`mb-5 rounded-[var(--operator-radius-control)] px-4 py-3 text-sm leading-5 ${
              isPositiveStatus
                ? "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink)]"
                : "bg-[var(--operator-brand)] text-[var(--operator-action-foreground)]"
            }`}
          >
            {statusMessages[status]}
          </p>
        )}

        <form action={clientSignIn} className="space-y-5">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/client"} />
          <div>
            <label htmlFor="email" className="block text-sm font-semibold text-[var(--operator-ink)]">
              Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              required
              autoComplete="email"
              className="mt-2 min-h-11 w-full rounded-[var(--operator-radius-control)] border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 text-sm text-[var(--operator-ink)] outline-none placeholder:text-[var(--operator-ink-subtle)] focus:border-[var(--operator-focus)]"
            />
          </div>
          <div>
            <label htmlFor="pin" className="block text-sm font-semibold text-[var(--operator-ink)]">
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
              className="mt-2 min-h-11 w-full rounded-[var(--operator-radius-control)] border border-[var(--operator-border)] bg-[var(--operator-surface)] px-3 text-sm text-[var(--operator-ink)] outline-none placeholder:text-[var(--operator-ink-subtle)] focus:border-[var(--operator-focus)]"
            />
            <p className="mt-2 text-xs leading-5 text-[var(--operator-ink-muted)]">
              Ingresa el PIN de 4 a 6 dígitos que te proporcionó tu agente.
            </p>
          </div>
          <OperatorButton type="submit" className="w-full">
            Entrar
          </OperatorButton>
        </form>
      </OperatorSurface>
    </main>
  );
}

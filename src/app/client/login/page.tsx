import Image from "next/image";
import { clientSignIn } from "./actions";

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function LockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      <path d="M12 14v2" />
    </svg>
  );
}

function PlaneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 16 3 21l4-9-4-9 18 5-9 4 9 4Z" />
      <path d="M7 12h5" />
    </svg>
  );
}

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
    <main
      className="relative isolate grid min-h-screen overflow-hidden bg-[#1f1017] px-5 py-8 text-[#40142c] lg:grid-cols-[minmax(16rem,1fr)_minmax(27rem,34rem)_minmax(16rem,1fr)] lg:px-12"
      style={{
        backgroundImage:
          "linear-gradient(90deg, color-mix(in srgb, var(--operator-brand-strong) 48%, transparent), color-mix(in srgb, var(--operator-brand-strong) 6%, transparent) 48%, color-mix(in srgb, var(--operator-brand-strong) 10%, transparent)), url('/hubit-login-office.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
      data-testid="client-login-atmosphere"
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(18,8,13,0.04),rgba(18,8,13,0.36))]" />
      <div aria-hidden="true" className="relative z-10 hidden self-center text-white lg:block">
        <p className="max-w-32 text-xs font-medium uppercase leading-8 tracking-[0.36em] text-white/78">People<br />Places<br />Possibilities</p>
        <div className="mt-8 h-px w-12 bg-white/70" />
      </div>

      <section
        data-testid="client-login-panel"
        className="relative z-10 my-auto w-full rounded-[1.7rem] border border-white/60 bg-[#fffaf4]/70 px-7 py-9 shadow-[0_30px_90px_rgba(19,7,13,0.36)] backdrop-blur-md sm:px-10 sm:py-11"
        aria-labelledby="client-login-title"
      >
        <div className="mb-8 text-center">
          <div className="flex justify-center">
            <Image src="/hubit-logo-transparent.png" alt="HUBit by TravelHub" width={728} height={282} priority className="h-20 w-auto object-contain sm:h-[5.7rem]" />
          </div>
          <h1 id="client-login-title" className="mt-5 font-serif text-4xl font-medium tracking-[-0.035em] text-[#4a1c35] sm:text-[2.75rem]">Bienvenido</h1>
          <p className="mt-3 text-[0.66rem] font-semibold uppercase tracking-[0.34em] text-[#7b6070]">Tu viaje. Más cerca.</p>
        </div>

        {status && statusMessages[status] && (
          <p role="status" aria-live="polite" className={`mb-5 rounded-xl px-4 py-3 text-sm leading-5 ${isPositiveStatus ? "border border-[var(--operator-gold)]/40 bg-[var(--operator-surface-subtle)]/90 text-[var(--operator-brand)]" : "border border-[var(--operator-coral)]/40 bg-[var(--operator-coral)]/10/90 text-[var(--operator-coral)]"}`}>
            {statusMessages[status]}
          </p>
        )}

        <form action={clientSignIn} className="space-y-4">
          <input type="hidden" name="redirectTo" value={redirectTo ?? "/client"} />
          <div>
            <label htmlFor="email" className="sr-only">Email</label>
            <div className="relative">
              <MailIcon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5c5965]" />
              <input id="email" type="email" name="email" required autoComplete="email" placeholder="Correo electrónico" className="h-14 w-full rounded-lg border border-[#ddd8dc] bg-white/92 pl-12 pr-4 text-sm text-[#2b2431] outline-none transition placeholder:text-[#8f8a93] focus:border-[#7e105b] focus:ring-2 focus:ring-[#7e105b]/20" />
            </div>
          </div>
          <div>
            <label htmlFor="pin" className="sr-only">PIN</label>
            <div className="relative">
              <LockIcon aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5c5965]" />
              <input id="pin" type="password" name="pin" inputMode="numeric" pattern="[0-9]*" minLength={4} maxLength={6} required autoComplete="current-password" placeholder="PIN" className="h-14 w-full rounded-lg border border-[#ddd8dc] bg-white/92 pl-12 pr-4 text-sm text-[#2b2431] outline-none transition placeholder:text-[#8f8a93] focus:border-[#7e105b] focus:ring-2 focus:ring-[#7e105b]/20" />
            </div>
            <p className="mt-2 text-xs leading-5 text-[#6d6070]">Ingresa el PIN de 4 a 6 dígitos que te proporcionó tu agente.</p>
          </div>
          <button type="submit" className="mt-1 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#72004b] px-4 text-base font-medium text-white shadow-[0_18px_28px_rgba(67,0,43,0.23)] transition hover:bg-[#59003a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffad18]">
            Entrar <span aria-hidden="true" className="text-2xl leading-none">→</span>
          </button>
        </form>

        <div aria-hidden="true" className="mt-8 flex items-center gap-4 text-[#72004b]">
          <span className="h-px flex-1 bg-[#d8d0d4]" />
          <PlaneIcon className="h-5 w-5 rotate-[-18deg]" />
          <span className="h-px flex-1 bg-[#d8d0d4]" />
        </div>
        <div className="mt-4 text-center text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-[#7b6070]">Plan | Manage | Travel | Together</div>
      </section>
    </main>
  );
}

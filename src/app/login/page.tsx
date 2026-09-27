import Image from "next/image";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { signIn } from "./actions";

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

function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
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

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirectTo?: string }>;
}) {
  const { error, redirectTo } = await searchParams;
  const configured = isSupabaseConfigured();

  return (
    <main
      data-testid="login-hubit-hero"
      className="relative isolate grid min-h-screen overflow-hidden bg-[#1f1017] px-5 py-8 text-[#40142c] lg:grid-cols-[minmax(16rem,1fr)_minmax(27rem,34rem)_minmax(16rem,1fr)] lg:px-12"
      style={{
        backgroundImage:
          "linear-gradient(90deg, color-mix(in srgb, var(--operator-brand-strong) 48%, transparent), color-mix(in srgb, var(--operator-brand-strong) 6%, transparent) 48%, color-mix(in srgb, var(--operator-brand-strong) 10%, transparent)), url('/hubit-login-office.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(18,8,13,0.04),rgba(18,8,13,0.36))]" />
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_44%,rgba(255,255,255,0.14),transparent_20%)]" />

      <div aria-hidden="true" className="relative z-10 hidden self-center text-white lg:block">
        <p className="max-w-32 text-xs font-medium uppercase leading-8 tracking-[0.36em] text-white/78">
          People<br />Places<br />Possibilities
        </p>
        <div className="mt-8 h-px w-12 bg-white/70" />
      </div>

      <section
        data-testid="login-panel"
        aria-label="HUBit by TravelHub"
        className="relative z-10 my-auto w-full rounded-[1.7rem] border border-white/60 bg-[#fffaf4]/70 px-7 py-9 shadow-[0_30px_90px_rgba(19,7,13,0.36)] backdrop-blur-md sm:px-10 sm:py-11"
      >
        <div data-testid="login-hubit-brand" className="mb-8 text-center">
          <div className="flex justify-center">
            <Image
              src="/hubit-logo-transparent.png"
              alt="HUBit by TravelHub"
              width={728}
              height={282}
              priority
              className="h-20 w-auto object-contain sm:h-[5.7rem]"
            />
          </div>
          <h1 className="mt-5 font-serif text-4xl font-medium tracking-[-0.035em] text-[#4a1c35] sm:text-[2.75rem]">Bienvenido</h1>
          <p className="mt-3 text-[0.66rem] font-semibold uppercase tracking-[0.34em] text-[#7b6070]">Tu agencia. Más lejos.</p>
        </div>

        {error && (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}

        {!configured ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm leading-6 text-amber-800">
            Supabase no está configurado todavía. Sigue los pasos de <code className="font-mono">SUPABASE_SETUP.md</code> para habilitar el login. Mientras tanto, el dashboard es accesible sin autenticación con datos de prueba.
          </p>
        ) : (
          <form action={signIn} className="space-y-4">
            <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
            <div>
              <label htmlFor="email" className="sr-only">Correo electrónico</label>
              <div className="relative">
                <MailIcon data-testid="login-email-icon" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5c5965]" />
                <input
                  id="email"
                  type="email"
                  name="email"
                  required
                  placeholder="Correo electrónico"
                  className="h-14 w-full rounded-lg border border-[#ddd8dc] bg-white/92 pl-12 pr-4 text-sm text-[#2b2431] outline-none transition placeholder:text-[#8f8a93] focus:border-[#7e105b] focus:ring-2 focus:ring-[#7e105b]/20"
                />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Contraseña</label>
              <div className="relative">
                <LockIcon data-testid="login-password-icon" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#5c5965]" />
                <input
                  id="password"
                  type="password"
                  name="password"
                  required
                  placeholder="Contraseña"
                  className="h-14 w-full rounded-lg border border-[#ddd8dc] bg-white/92 pl-12 pr-12 text-sm text-[#2b2431] outline-none transition placeholder:text-[#8f8a93] focus:border-[#7e105b] focus:ring-2 focus:ring-[#7e105b]/20"
                />
                <EyeIcon aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#4e4b55]" />
              </div>
            </div>
            <div className="flex items-center justify-between gap-4 text-[0.72rem] text-[#4f4650]">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="remember" className="h-4 w-4 rounded border-[#bdb6bd] text-[#72004b]" />
                Mantener sesión iniciada
              </label>
              <span className="font-semibold text-[#72004b] underline underline-offset-2">¿Olvidaste tu contraseña?</span>
            </div>
            <button
              type="submit"
              className="mt-1 flex h-14 w-full items-center justify-center gap-3 rounded-full bg-[#72004b] px-4 text-base font-medium text-white shadow-[0_18px_28px_rgba(67,0,43,0.23)] transition hover:bg-[#59003a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffad18]"
            >
              Iniciar sesión <span aria-hidden="true" className="text-2xl leading-none">→</span>
            </button>
          </form>
        )}

        <div data-testid="login-airplane-divider" aria-hidden="true" className="mt-8 flex items-center gap-4 text-[#72004b]">
          <span className="h-px flex-1 bg-[#d8d0d4]" />
          <PlaneIcon className="h-5 w-5 rotate-[-18deg] fill-[#72004b]/10" />
          <span className="h-px flex-1 bg-[#d8d0d4]" />
        </div>
        <div className="mt-4 text-center text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-[#7b6070]">Plan | Manage | Travel | Together</div>
      </section>

      <div aria-hidden="true" className="relative z-10 hidden self-end justify-self-end pb-8 text-right text-xs font-medium uppercase leading-7 tracking-[0.28em] text-white/75 lg:block">
        Travel<br />connects<br />people
        <div className="ml-auto mt-5 h-px w-12 bg-white/70" />
      </div>
    </main>
  );
}

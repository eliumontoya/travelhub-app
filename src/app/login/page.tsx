import Image from "next/image";
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
    <main
      data-testid="login-hubit-hero"
      className="relative isolate grid min-h-screen overflow-hidden bg-[#1f1017] px-5 py-8 text-[var(--operator-ink)] lg:grid-cols-[minmax(16rem,1fr)_minmax(28rem,35rem)_minmax(16rem,1fr)] lg:px-12"
      style={{ backgroundImage: "linear-gradient(90deg, rgba(19, 8, 14, 0.5), rgba(19, 8, 14, 0.08) 48%, rgba(19, 8, 14, 0.12)), url('/hubit-login-office.png')", backgroundPosition: "center", backgroundSize: "cover" }}
    >
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(16,8,13,0.05),rgba(16,8,13,0.42))]" />
      <div className="relative z-10 hidden self-center text-white lg:block">
        <p className="max-w-32 text-xs font-medium uppercase leading-8 tracking-[0.36em] text-white/75">People<br />Places<br />Possibilities</p>
        <div className="mt-8 h-px w-12 bg-[var(--operator-gold)]/80" />
      </div>

      <section data-testid="login-panel" aria-label="HUBit by TravelHub" className="relative z-10 my-auto w-full rounded-[1.8rem] border border-white/60 bg-[#fffdf9]/88 px-7 py-9 shadow-[0_28px_90px_rgba(19,7,13,0.38)] backdrop-blur-xl sm:px-10 sm:py-11">
        <div data-testid="login-hubit-brand" className="mb-8 text-center">
          <div className="flex justify-center">
            <Image src="/logo-transparent.png" alt="HUBit by TravelHub" width={2017} height={780} priority className="h-20 w-auto object-contain sm:h-24" />
          </div>
          <h1 className="mt-6 font-serif text-4xl font-medium tracking-[-0.035em] text-[var(--operator-ink)] sm:text-5xl">Bienvenido</h1>
          <p className="mt-3 text-[0.68rem] font-semibold uppercase tracking-[0.34em] text-[var(--operator-ink-muted)]">Tu agencia. Más lejos.</p>
        </div>

        {error && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}

        {!configured ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-4 text-sm leading-6 text-amber-800">Supabase no está configurado todavía. Sigue los pasos de <code className="font-mono">SUPABASE_SETUP.md</code> para habilitar el login. Mientras tanto, el dashboard es accesible sin autenticación con datos de prueba.</p>
        ) : (
          <form action={signIn} className="space-y-5">
            <input type="hidden" name="redirectTo" value={redirectTo ?? "/dashboard"} />
            <div><label htmlFor="email" className="block text-sm font-medium text-[var(--operator-ink)]">Correo electrónico</label><input id="email" type="email" name="email" required className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white/95 px-4 py-3 text-sm text-[var(--operator-ink)] outline-none transition focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-surface-hover)]" /></div>
            <div><label htmlFor="password" className="block text-sm font-medium text-[var(--operator-ink)]">Contraseña</label><input id="password" type="password" name="password" required className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white/95 px-4 py-3 text-sm text-[var(--operator-ink)] outline-none transition focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-surface-hover)]" /></div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" className="w-full rounded-full bg-[var(--operator-brand)] px-4 py-3.5 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] transition hover:bg-[var(--operator-brand-strong)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]">Iniciar sesión <span aria-hidden="true" className="ml-2">→</span></button>
          </form>
        )}
        <div className="mt-8 border-t border-[var(--operator-border)] pt-4 text-center text-[0.64rem] font-semibold uppercase tracking-[0.28em] text-[var(--operator-ink-muted)]">Plan · Manage · Travel · Together</div>
      </section>

      <div aria-hidden="true" className="relative z-10 hidden self-end justify-self-end pb-8 text-right text-xs font-medium uppercase leading-7 tracking-[0.28em] text-white/75 lg:block">Travel connects<br />people</div>
    </main>
  );
}

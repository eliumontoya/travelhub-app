import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/components/LanguageToggle";
import { DEFAULT_LANG, dictionary, getLangFromSearchParams } from "@/lib/i18n";

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const lang = getLangFromSearchParams(await searchParams) ?? DEFAULT_LANG;
  const t = dictionary[lang];

  return (
    <main
      data-testid="landing-hubit-hero"
      className="relative isolate grid min-h-screen overflow-hidden bg-[var(--operator-canvas)] text-[var(--operator-ink)]"
      style={{
        backgroundImage:
          "linear-gradient(180deg, color-mix(in srgb, var(--operator-brand-strong) 56%, transparent), color-mix(in srgb, var(--operator-brand-strong) 28%, transparent) 48%, color-mix(in srgb, var(--operator-brand-strong) 18%, transparent)), url('/hubit-login-office.png')",
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(18,8,13,0.10),rgba(18,8,13,0.42))]"
      />

      <header className="relative z-10 flex items-center justify-between gap-4 px-5 pt-6 sm:px-10 sm:pt-8">
        <div className="flex items-center gap-3 text-white">
          <Image
            src="/hubit-logo-transparent.png"
            alt="HUBit by TravelHub"
            width={728}
            height={282}
            priority
            className="h-9 w-auto object-contain sm:h-11"
          />
          <span className="hidden text-[0.6rem] font-semibold uppercase tracking-[0.32em] text-white/80 sm:inline">
            Plan | Manage | Travel | Together
          </span>
        </div>
        <LanguageToggle lang={lang} variant="light" />
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-5 pb-12 pt-10 text-center sm:px-10 sm:pt-16">
        <p className="text-[0.66rem] font-semibold uppercase tracking-[0.36em] text-white/82">
          People · Places · Possibilities
        </p>
        <h1 className="mt-5 max-w-3xl font-serif text-4xl font-medium tracking-[-0.035em] text-white sm:text-6xl">
          {t.landingHeadline}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/86 sm:text-lg">
          {t.landingSubhead}
        </p>
      </section>

      <div
        data-testid="landing-split"
        className="relative z-10 mx-auto grid w-full max-w-5xl grid-cols-1 gap-4 px-5 pb-12 sm:px-10 md:grid-cols-2 md:gap-6 md:pb-16"
      >
        <aside
          data-testid="landing-agent-side"
          aria-label={t.landingAgentLabel}
          className="relative isolate flex flex-col justify-between overflow-hidden rounded-[1.25rem] border border-white/40 bg-[var(--operator-brand)]/72 p-6 text-white shadow-[var(--operator-shadow-panel)] backdrop-blur-md sm:p-8"
          style={{
            backgroundImage:
              "linear-gradient(155deg, color-mix(in srgb, var(--operator-brand-strong) 78%, transparent), color-mix(in srgb, var(--operator-brand) 64%, transparent) 60%, color-mix(in srgb, var(--operator-brand) 38%, transparent))",
          }}
        >
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-white/80">
              {t.landingAgentHint}
            </p>
            <h2 className="mt-3 font-serif text-2xl font-medium tracking-[-0.025em] text-white sm:text-3xl">
              HUBit Workspace
            </h2>
          </div>
          <Link
            data-testid="landing-agent-cta"
            href="/login"
            aria-label={t.landingAgentLabel}
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--operator-action)] px-6 text-sm font-semibold tracking-wide text-[var(--operator-action-foreground)] shadow-[var(--operator-shadow-action)] transition hover:bg-[var(--operator-action-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]"
          >
            {t.landingAgentLabel}
            <span aria-hidden="true" className="text-lg leading-none">
              →
            </span>
          </Link>
        </aside>

        <aside
          data-testid="landing-traveler-side"
          aria-label={t.landingTravelerLabel}
          className="relative isolate flex flex-col justify-between overflow-hidden rounded-[1.25rem] border border-white/40 bg-[var(--operator-accent)]/72 p-6 text-[var(--operator-accent-foreground)] shadow-[var(--operator-shadow-panel)] backdrop-blur-md sm:p-8"
          style={{
            backgroundImage:
              "linear-gradient(155deg, color-mix(in srgb, var(--operator-gold) 88%, transparent), color-mix(in srgb, var(--operator-accent) 70%, transparent) 60%, color-mix(in srgb, var(--operator-accent) 44%, transparent))",
          }}
        >
          <div>
            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.32em] text-[var(--operator-accent-foreground)]/82">
              {t.landingTravelerHint}
            </p>
            <h2 className="mt-3 font-serif text-2xl font-medium tracking-[-0.025em] text-[var(--operator-accent-foreground)] sm:text-3xl">
              HUBit Traveler
            </h2>
          </div>
          <Link
            data-testid="landing-traveler-cta"
            href="/client/login"
            aria-label={t.landingTravelerLabel}
            className="mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--operator-accent)] px-6 text-sm font-semibold tracking-wide text-[var(--operator-accent-foreground)] shadow-[var(--operator-shadow-action)] transition hover:bg-[var(--operator-accent-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--operator-focus)]"
          >
            {t.landingTravelerLabel}
            <span aria-hidden="true" className="text-lg leading-none">
              →
            </span>
          </Link>
        </aside>
      </div>
    </main>
  );
}

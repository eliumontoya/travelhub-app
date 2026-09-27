"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Lang, LANG_QUERY_PARAM, LANG_STORAGE_KEY, isLang } from "@/lib/i18n";

type LanguageToggleVariant = "dark" | "light";

export function LanguageToggle({
  lang,
  variant = "dark",
}: {
  lang: Lang;
  variant?: LanguageToggleVariant;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get(LANG_QUERY_PARAM)) return;
    const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(stored) && stored !== lang) {
      const params = new URLSearchParams(searchParams.toString());
      params.set(LANG_QUERY_PARAM, stored);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setLang(next: Lang) {
    window.localStorage.setItem(LANG_STORAGE_KEY, next);
    const params = new URLSearchParams(searchParams.toString());
    params.set(LANG_QUERY_PARAM, next);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const containerCls =
    variant === "light"
      ? "inline-flex overflow-hidden rounded-md border border-[var(--operator-border)] text-xs dark:border-[var(--operator-border)]"
      : "inline-flex overflow-hidden rounded-md border border-white/40 text-xs";

  const btn = (active: boolean) =>
    variant === "light"
      ? `px-2 py-1 ${active ? "bg-[var(--operator-brand-strong)] text-white" : "text-[var(--operator-ink)] hover:bg-[var(--operator-surface-subtle)] dark:text-[var(--operator-brand)] dark:hover:bg-[var(--operator-brand)]"}`
      : `px-2 py-1 ${active ? "bg-white text-[var(--operator-brand)]" : "text-white/80 hover:bg-white/10"}`;

  return (
    <div className={containerCls}>
      <button
        type="button"
        onClick={() => setLang("es")}
        aria-pressed={lang === "es"}
        className={btn(lang === "es")}
      >
        ES
      </button>
      <button
        type="button"
        onClick={() => setLang("en")}
        aria-pressed={lang === "en"}
        className={btn(lang === "en")}
      >
        EN
      </button>
    </div>
  );
}

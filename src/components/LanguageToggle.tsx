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
      ? "inline-flex overflow-hidden rounded-md border border-gray-300 text-xs dark:border-gray-600"
      : "inline-flex overflow-hidden rounded-md border border-white/40 text-xs";

  const btn = (active: boolean) =>
    variant === "light"
      ? `px-2 py-1 ${active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"}`
      : `px-2 py-1 ${active ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/10"}`;

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

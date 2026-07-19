"use client";

import { useEffect, useRef, useState } from "react";
import { formatDateCompact } from "@/lib/item-meta";
import { DEFAULT_LANG, Lang, dictionary } from "@/lib/i18n";

export function TripDaySidebar({
  days,
  className,
  lang = DEFAULT_LANG,
}: {
  days: { id: string; date: string }[];
  className?: string;
  lang?: Lang;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    let observer: IntersectionObserver | null = null;

    function setup() {
      if (!mediaQuery.matches) return;

      const entriesMap = new Map<Element, string>();
      observer = new IntersectionObserver(
        (observedEntries) => {
          const visible = observedEntries.filter((entry) => entry.isIntersecting);
          if (visible.length === 0) return;
          const topMost = visible.reduce((a, b) =>
            a.boundingClientRect.top <= b.boundingClientRect.top ? a : b
          );
          const id = entriesMap.get(topMost.target);
          if (id && id !== activeIdRef.current) {
            activeIdRef.current = id;
            setActiveId(id);
          }
        },
        { rootMargin: "-20% 0px -70% 0px", threshold: 0 }
      );

      for (const day of days) {
        const el = document.getElementById(`day-${day.id}`);
        if (el) {
          entriesMap.set(el, day.id);
          observer.observe(el);
        }
      }
    }

    function teardown() {
      observer?.disconnect();
      observer = null;
    }

    function handleChange() {
      teardown();
      setup();
    }

    setup();
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
      teardown();
    };
  }, [days]);

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = document.getElementById(`day-${id}`);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    activeIdRef.current = id;
    setActiveId(id);
  }

  return (
    <nav className={className} aria-label={dictionary[lang].daysNav}>
      <ul className="space-y-1">
        {days.map((day) => (
          <li key={day.id}>
            <a
              href={`#day-${day.id}`}
              onClick={(e) => handleClick(e, day.id)}
              className={`block rounded-md px-2 py-1 text-sm capitalize ${
                activeId === day.id
                  ? "font-semibold text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {formatDateCompact(day.date, lang)}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

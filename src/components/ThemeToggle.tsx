"use client";

import { useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return document.documentElement.classList.contains("dark");
  });

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      className={`flex h-9 min-w-9 items-center justify-center rounded-full bg-[var(--operator-surface-subtle)] px-2 text-[0.65rem] font-bold text-[var(--operator-brand)] hover:bg-[var(--operator-surface-hover)] dark:bg-[var(--operator-surface-subtle)] dark:text-[var(--operator-accent)] ${className}`}
    >
      {isDark ? "CL" : "OS"}
    </button>
  );
}

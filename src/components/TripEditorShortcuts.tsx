"use client";

import { useEffect } from "react";

export const ADD_DAY_TRIGGER_ID = "shortcut-add-day-trigger";
export const ADD_ITEM_LAST_DAY_TRIGGER_ID = "shortcut-add-item-trigger";

export function TripEditorShortcuts() {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();
      if (key === "n") {
        document.getElementById(ADD_DAY_TRIGGER_ID)?.click();
      } else if (key === "i") {
        document.getElementById(ADD_ITEM_LAST_DAY_TRIGGER_ID)?.click();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <p className="mt-3 text-center text-xs text-gray-400">
      <kbd className="rounded border border-gray-300 px-1 py-0.5">n</kbd> nuevo día ·{" "}
      <kbd className="rounded border border-gray-300 px-1 py-0.5">i</kbd> nuevo item ·{" "}
      <kbd className="rounded border border-gray-300 px-1 py-0.5">esc</kbd> cerrar
    </p>
  );
}

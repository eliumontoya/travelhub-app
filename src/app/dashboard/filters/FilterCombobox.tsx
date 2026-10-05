"use client";

import { useMemo, useRef, useState } from "react";
import { normalizeFilterText } from "@/lib/trip-filters";

export type FilterComboboxOption = { id: string; name: string };

/**
 * Generic single/multi autocomplete used by the dashboard filter bar. Owns its
 * transient query/open/just-selected state; the shell never reads it. The
 * client-only clear-on-empty-blur quirk is opt-in through `clearOnEmptyBlur`.
 */
export function FilterCombobox({
  options,
  selectedIds,
  mode,
  placeholder,
  clearOnEmptyBlur = false,
  onSelect,
  onClear,
}: {
  options: FilterComboboxOption[];
  selectedIds: string[];
  mode: "single" | "multi";
  placeholder: string;
  clearOnEmptyBlur?: boolean;
  onSelect: (id: string) => void;
  onClear?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const justSelected = useRef(false);

  const results = useMemo(() => {
    const q = normalizeFilterText(query.trim());
    if (!q) return [];
    return options
      .filter((option) => mode !== "multi" || !selectedIds.includes(option.id))
      .filter((option) => normalizeFilterText(option.name).includes(q))
      .slice(0, 8);
  }, [options, query, mode, selectedIds]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setTimeout(() => setOpen(false), 150);
          // Clear client filter when user empties the search field and leaves
          if (clearOnEmptyBlur && !justSelected.current && !query.trim() && selectedIds.length) {
            onClear?.();
          }
          justSelected.current = false;
        }}
        placeholder={placeholder}
        className="w-full rounded-xl border border-[#dbc7d1] bg-white px-3 py-2 text-sm text-[#3f1a2f] shadow-[0_2px_8px_rgba(74,9,47,0.03)] outline-none transition placeholder:text-[#927586] focus:border-[#65003d] focus:ring-2 focus:ring-[#65003d]/15 dark:border-[#603d50] dark:bg-[#24141f] dark:text-[#f8eaf0]"
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-[#decbd4] bg-white shadow-[0_12px_26px_rgba(74,9,47,0.16)] dark:border-[#603d50] dark:bg-[#24141f]">
          {results.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  justSelected.current = true;
                  setQuery("");
                  setOpen(false);
                  onSelect(option.id);
                }}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-[#fff4f8] dark:hover:bg-[#3a1f30]"
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Tag } from "@/types";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Variante creatable de ClientMultiCombobox: además de seleccionar tags
// existentes (checkboxes), permite escribir un nombre nuevo y "crearlo" (la
// fila del catálogo real solo se crea al guardar, vía getOrCreateTag en el
// server action — NUNCA en cada tecleo/optimista).
//
// Emite DOS grupos de <input type="hidden">: uno con name="tagIds" (ids de
// tags existentes seleccionados) y otro con name="newTagNames" (nombres
// nuevos en staging), para que el server action distinga cuáles ya tienen id
// y cuáles requieren getOrCreateTag antes de llamar setTripTags.
export function TagMultiCombobox({
  tags,
  defaultTagIds,
}: {
  tags: Tag[];
  defaultTagIds?: string[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(defaultTagIds ?? []);
  const [newNames, setNewNames] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedTags = useMemo(
    () => selectedIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => Boolean(t)),
    [tags, selectedIds]
  );

  const trimmedQuery = query.trim();
  const normalizedQuery = normalize(trimmedQuery);

  const results = useMemo(() => {
    const q = normalizedQuery;
    if (!q) return [];
    return tags
      .filter((t) => !selectedIds.includes(t.id))
      .filter((t) => normalize(t.name).includes(q))
      .slice(0, 8);
  }, [tags, normalizedQuery, selectedIds]);

  const recentTags = useMemo(() => {
    if (trimmedQuery) return []; // Only show when query is empty
    return [...tags]
      .filter((t) => !selectedIds.includes(t.id))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [tags, trimmedQuery, selectedIds]);

  // Solo se muestra "Crear '{query}'" si no hay ningún match case-insensitive
  // exacto ni entre tags existentes ni entre nombres ya en staging.
  const hasExactMatch =
    trimmedQuery.length > 0 &&
    (tags.some((t) => normalize(t.name) === normalizedQuery) ||
      newNames.some((n) => normalize(n) === normalizedQuery));

  function handleSelectExisting(tag: Tag) {
    setSelectedIds((prev) => (prev.includes(tag.id) ? prev : [...prev, tag.id]));
    setQuery("");
    setIsOpen(false);
  }

  function handleCreateNew() {
    if (!trimmedQuery || hasExactMatch) return;
    // Dedupe: si el nombre coincide case-insensitive con un tag existente,
    // seleccionar ese en vez de crear uno duplicado.
    const existing = tags.find((t) => normalize(t.name) === normalizedQuery);
    if (existing) {
      handleSelectExisting(existing);
      return;
    }
    setNewNames((prev) => [...prev, trimmedQuery]);
    setQuery("");
    setIsOpen(false);
  }

  function handleRemoveExisting(tagId: string) {
    setSelectedIds((prev) => prev.filter((id) => id !== tagId));
  }

  function handleRemoveNew(name: string) {
    setNewNames((prev) => prev.filter((n) => n !== name));
  }

  const showCreateAffordance = trimmedQuery.length > 0 && !hasExactMatch;

  return (
    <div>
      {(selectedTags.length > 0 || newNames.length > 0) && (
        <ul className="mb-2 flex flex-wrap gap-2">
          {selectedTags.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-1 rounded-full bg-[var(--operator-surface-subtle)] px-3 py-1 text-sm text-[var(--operator-brand)]"
            >
              {t.name}
              <button
                type="button"
                onClick={() => handleRemoveExisting(t.id)}
                aria-label={`Quitar ${t.name}`}
                className="text-[var(--operator-gold)] hover:text-[var(--operator-brand)]"
              >
                ×
              </button>
              <input type="hidden" name="tagIds" value={t.id} />
            </li>
          ))}
          {newNames.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-[var(--operator-surface-subtle)] px-3 py-1 text-sm text-[var(--operator-brand)]"
            >
              {name}
              <span className="text-xs text-[var(--operator-brand)]">(nuevo)</span>
              <button
                type="button"
                onClick={() => handleRemoveNew(name)}
                aria-label={`Quitar ${name}`}
                className="text-[var(--operator-gold)] hover:text-[var(--operator-brand)]"
              >
                ×
              </button>
              <input type="hidden" name="newTagNames" value={name} />
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
          placeholder="Buscar o crear tag…"
          className="mt-1 w-full rounded-lg border border-[var(--operator-border)] px-3 py-2 text-sm"
          autoComplete="off"
        />

        {isOpen && (results.length > 0 || recentTags.length > 0 || showCreateAffordance) && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-[var(--operator-border)] bg-white shadow-md">
            {recentTags.length > 0 && results.length === 0 && (
              <>
                <li className="px-3 pt-2 pb-1 text-xs font-medium text-[var(--operator-ink-subtle)] uppercase tracking-wide pointer-events-none select-none">
                  Recientes
                </li>
                {recentTags.map((t) => (
                  <li key={`recent-${t.id}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectExisting(t)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--operator-canvas)]"
                    >
                      {t.name}
                    </button>
                  </li>
                ))}
              </>
            )}
            {results.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectExisting(t)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-[var(--operator-canvas)]"
                >
                  {t.name}
                </button>
              </li>
            ))}
            {showCreateAffordance && (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleCreateNew}
                  className="block w-full px-3 py-2 text-left text-sm text-[var(--operator-brand)] hover:bg-[var(--operator-surface-subtle)]"
                >
                  Crear &ldquo;{trimmedQuery}&rdquo;
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}

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
              className="flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-700"
            >
              {t.name}
              <button
                type="button"
                onClick={() => handleRemoveExisting(t.id)}
                aria-label={`Quitar ${t.name}`}
                className="text-blue-400 hover:text-blue-600"
              >
                ×
              </button>
              <input type="hidden" name="tagIds" value={t.id} />
            </li>
          ))}
          {newNames.map((name) => (
            <li
              key={name}
              className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-700"
            >
              {name}
              <span className="text-xs text-emerald-500">(nuevo)</span>
              <button
                type="button"
                onClick={() => handleRemoveNew(name)}
                aria-label={`Quitar ${name}`}
                className="text-emerald-400 hover:text-emerald-600"
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
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          autoComplete="off"
        />

        {isOpen && (results.length > 0 || showCreateAffordance) && (
          <ul className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-md">
            {results.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectExisting(t)}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
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
                  className="block w-full px-3 py-2 text-left text-sm text-emerald-700 hover:bg-emerald-50"
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

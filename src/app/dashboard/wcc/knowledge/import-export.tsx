"use client";

import { useRef, useState } from "react";

type ImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  errors: number;
  errorDetails?: { row: number; error: string }[];
};

export function KnowledgeImportExport({ totalCount }: { totalCount: number }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    const a = document.createElement("a");
    a.href = "/api/wcc/knowledge/export";
    a.download = "knowledge-base-export.xlsx";
    a.click();
  }

  async function handleImport(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/wcc/knowledge/import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al importar");
      } else {
        setResult(json);
        if (fileRef.current) fileRef.current.value = "";
      }
    } catch {
      setError("Error de conexión al importar");
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
      <h3 className="text-lg font-semibold text-[var(--operator-brand)]">Importar / Exportar Excel</h3>
      <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">
        Exporta toda la knowledge base ({totalCount} registros) a Excel para que el cliente la actualice, o importa un archivo actualizado.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl border border-[var(--operator-gold)]/40 bg-[var(--operator-gold)]/10 px-4 py-2 text-sm font-semibold text-[var(--operator-gold)] hover:bg-[var(--operator-gold)]/20"
          >
            Descargar Excel
          </button>
        </div>

        <form onSubmit={handleImport} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="rounded-xl border border-[var(--operator-border)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-sm text-[var(--operator-ink-muted)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--operator-surface-subtle)] file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-[var(--operator-brand)]"
          />
          <button
            type="submit"
            disabled={importing}
            className="rounded-xl bg-[var(--operator-brand)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
          >
            {importing ? "Importando..." : "Importar Excel"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-[var(--operator-coral)]/40 bg-[var(--operator-coral)]/10 p-3 text-sm text-[var(--operator-coral)]">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-[var(--operator-gold)]/40 bg-[var(--operator-gold)]/10 p-3 text-sm text-[var(--operator-gold)]">
          <p className="font-semibold">Importación completada</p>
          <p className="mt-1">
            Creadas: {result.created} | Actualizadas: {result.updated}
            {result.errors > 0 && <span className="text-[var(--operator-coral)]"> | Errores: {result.errors}</span>}
          </p>
          {result.errorDetails && result.errorDetails.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-[var(--operator-coral)]">
              {result.errorDetails.map((e, i) => (
                <li key={i}>Fila {e.row}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-[var(--operator-ink-muted)] hover:text-[var(--operator-brand)]">
          Formato del archivo Excel
        </summary>
        <div className="mt-2 text-xs text-[var(--operator-ink-subtle)]">
          <p className="mb-2">Columnas requeridas:</p>
          <ul className="list-inside list-disc space-y-1">
            <li><strong>topic</strong> — Tema (máx 120 caracteres)</li>
            <li><strong>question</strong> — Pregunta (máx 500 caracteres)</li>
            <li><strong>answer</strong> — Respuesta (máx 4000 caracteres)</li>
            <li><strong>tags</strong> — Tags separados por comas (opcional, máx 12)</li>
            <li><strong>source</strong> — Fuente (opcional, máx 300 caracteres)</li>
            <li><strong>status</strong> — draft, approved o archived</li>
            <li><strong>id</strong> — ID existente para actualizar (no crear nuevo)</li>
          </ul>
          <p className="mt-2">Si la fila tiene <strong>id</strong>, se actualiza. Si no tiene, se crea una nueva entrada.</p>
        </div>
      </details>
    </section>
  );
}

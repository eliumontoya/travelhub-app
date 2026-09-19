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
    <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <h3 className="text-lg font-semibold text-white">Importar / Exportar Excel</h3>
      <p className="mt-1 text-sm text-slate-400">
        Exporta toda la knowledge base ({totalCount} registros) a Excel para que el cliente la actualice, o importa un archivo actualizado.
      </p>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-2 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/20"
          >
            Descargar Excel
          </button>
        </div>

        <form onSubmit={handleImport} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-200"
          />
          <button
            type="submit"
            disabled={importing}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
          >
            {importing ? "Importando..." : "Importar Excel"}
          </button>
        </form>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-400/40 bg-red-400/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-3 text-sm text-emerald-200">
          <p className="font-semibold">Importación completada</p>
          <p className="mt-1">
            Creadas: {result.created} | Actualizadas: {result.updated}
            {result.errors > 0 && <span className="text-red-300"> | Errores: {result.errors}</span>}
          </p>
          {result.errorDetails && result.errorDetails.length > 0 && (
            <ul className="mt-2 list-inside list-disc text-xs text-red-300">
              {result.errorDetails.map((e, i) => (
                <li key={i}>Fila {e.row}: {e.error}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-200">
          Formato del archivo Excel
        </summary>
        <div className="mt-2 text-xs text-slate-500">
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

"use client";

import type { Client } from "@/types";

interface ExportClientsCsvButtonProps {
  clients: Client[];
}

const CSV_HEADERS = ["Nombre", "Email", "Teléfono", "Notas", "Creado"] as const;

function escapeCsvField(value: string): string {
  // Wrap in quotes and double up internal quotes whenever the field contains
  // a comma, quote, or newline, per RFC 4180.
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function htmlToText(html: string): string {
  // Notes are stored as sanitized HTML; for a plain-text CSV export we keep
  // only the text content.
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

function buildCsv(clients: Client[]): string {
  const rows = clients.map((client) =>
    [client.name, client.email, client.phone, htmlToText(client.notes ?? ""), client.createdAt]
      .map((field) => escapeCsvField(field))
      .join(",")
  );
  return [CSV_HEADERS.join(","), ...rows].join("\r\n");
}

export function ExportClientsCsvButton({ clients }: ExportClientsCsvButtonProps) {
  function handleExport() {
    const csv = buildCsv(clients);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `clientes-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="rounded-lg border border-[var(--operator-border)] bg-white px-4 py-2 text-center text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
    >
      Exportar CSV
    </button>
  );
}

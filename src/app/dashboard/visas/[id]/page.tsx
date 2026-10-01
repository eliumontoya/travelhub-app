import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ALL_CLIENTS_PAGE_SIZE,
  getClients,
  getVisaById,
  getVisaDocuments,
  getVisaStatusHistory,
} from "@/lib/data";
import { requireFeature } from "@/lib/auth/roles";
import type {
  Client,
  VisaDocument,
  VisaStatus,
  VisaStatusHistoryEntry,
} from "@/types";
import { VisaDetailEditor } from "./VisaDetailEditor";
import { VisaStatusControl } from "./VisaStatusControl";
import { VisaClientManager } from "./VisaClientManager";
import { VisaDocumentsPanel } from "./VisaDocumentsPanel";

const STATUS_META: Record<VisaStatus, { label: string; classes: string }> = {
  pending: {
    label: "Pending",
    classes:
      "bg-[var(--operator-surface-subtle)] text-[var(--operator-ink-muted)]",
  },
  in_progress: {
    label: "In progress",
    classes: "bg-amber-100 text-amber-800",
  },
  completed: {
    label: "Completed",
    classes: "bg-green-100 text-green-800",
  },
};

const VISA_TRANSITIONS: Record<VisaStatus, VisaStatus[]> = {
  pending: ["in_progress"],
  in_progress: ["completed"],
  completed: [],
};

function formatDate(value: string): string {
  const date = value.length === 10 ? new Date(`${value}T00:00:00.000Z`) : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function VisaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireFeature("visas");
  const { id } = await params;

  const [visa, documents, { items: allClients }] = await Promise.all([
    getVisaById(id),
    getVisaDocuments(id).catch(() => [] as (VisaDocument & { url: string | null })[]),
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
  ]);

  if (!visa) notFound();

  // Status history may differ from the visa's embedded history if a transition
  // occurred between the parallel fetches above; re-fetch sequentially so the
  // timeline shows the canonical history at render time.
  const statusHistory: VisaStatusHistoryEntry[] =
    visa.statusHistory.length > 0 ? visa.statusHistory : await getVisaStatusHistory(id);

  const clientOptions: Client[] = allClients;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <Link
        href="/dashboard/visas"
        className="text-sm text-[var(--operator-ink-muted)] hover:underline"
      >
        ← Back to visas
      </Link>

      <header className="mt-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-[-0.02em] text-[var(--operator-ink)]">
            {visa.country} — {visa.visaType}
          </h1>
          <span
            data-testid={`visa-status-${visa.status}`}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_META[visa.status].classes}`}
          >
            {STATUS_META[visa.status].label}
          </span>
        </div>
        <p className="mt-1 text-sm text-[var(--operator-ink-muted)]">
          Deadline {formatDate(visa.deadline)} · Price {formatPrice(visa.price)}
        </p>
      </header>

      <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface)] p-5">
        <h2 className="mb-3 text-base font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
          Editable fields
        </h2>
        <VisaDetailEditor visa={visa} />
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface)] p-5">
        <h2 className="mb-3 text-base font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
          Assigned clients
        </h2>
        <VisaClientManager
          visaId={visa.id}
          initialClients={visa.clients}
          clientOptions={clientOptions}
        />
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface)] p-5">
        <h2 className="mb-3 text-base font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
          Status
        </h2>
        <VisaStatusControl
          visaId={visa.id}
          currentStatus={visa.status}
          allowedTransitions={VISA_TRANSITIONS[visa.status]}
        />
        <h3 className="mt-5 mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--operator-ink-muted)]">
          Status history
        </h3>
        <StatusHistoryTimeline entries={statusHistory} />
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--operator-border)] bg-[var(--operator-surface)] p-5">
        <h2 className="mb-3 text-base font-semibold tracking-[-0.02em] text-[var(--operator-ink)]">
          Documents
        </h2>
        <VisaDocumentsPanel
          visaId={visa.id}
          initialDocuments={documents}
          assignedClients={visa.clients}
        />
      </section>
    </main>
  );
}

function StatusHistoryTimeline({ entries }: { entries: VisaStatusHistoryEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-[var(--operator-ink-muted)]">
        No status changes yet.
      </p>
    );
  }
  return (
    <ol className="space-y-3" data-testid="visa-status-history">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--operator-border-subtle)] bg-[var(--operator-surface-subtle)] px-3 py-2 text-sm"
        >
          <span className="font-medium text-[var(--operator-ink)]">
            {entry.fromStatus ? STATUS_META[entry.fromStatus].label : "Created"}
          </span>
          <span aria-hidden="true" className="text-[var(--operator-ink-subtle)]">
            →
          </span>
          <span className="font-medium text-[var(--operator-ink)]">
            {STATUS_META[entry.toStatus].label}
          </span>
          <span className="ml-auto text-xs text-[var(--operator-ink-muted)]">
            {formatDateTime(entry.changedAt)}
          </span>
        </li>
      ))}
    </ol>
  );
}

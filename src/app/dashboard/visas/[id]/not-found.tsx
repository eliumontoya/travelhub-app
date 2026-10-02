import Link from "next/link";

export default function VisaNotFound() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-[var(--operator-brand)]">Visa not found</h1>
      <p className="text-sm text-[var(--operator-ink-muted)]">
        This visa application does not exist or has been deleted.
      </p>
      <Link
        href="/dashboard/visas"
        className="rounded-lg bg-[var(--operator-brand)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--operator-brand-strong)]"
      >
        Back to visas
      </Link>
    </main>
  );
}

import Link from "next/link";

type NoticeTone = "safe" | "warning";

export function WccNotice({ children, tone = "safe" }: { children: React.ReactNode; tone?: NoticeTone }) {
  const toneClasses = tone === "warning" ? "border-[var(--operator-gold)]/40 bg-[#fff8e8] text-[var(--operator-brand)]" : "border-[var(--operator-border)] bg-white/94 text-[var(--operator-ink-muted)]";
  return <div className={`mt-6 rounded-2xl border p-4 text-sm ${toneClasses}`}>{children}</div>;
}

export function WccEmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--operator-border)] bg-white/80 p-6 text-sm text-[var(--operator-ink-muted)]">
      <p className="font-semibold text-[var(--operator-brand)]">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-4 inline-flex rounded-xl border border-[var(--operator-border)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--operator-gold)] hover:border-[var(--operator-gold)] hover:text-[var(--operator-gold)]">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function WccBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-[var(--operator-gold)] hover:text-[var(--operator-gold)]">← {children}</Link>;
}

export function WccInlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-semibold text-[var(--operator-gold)] hover:underline">{children}</Link>;
}

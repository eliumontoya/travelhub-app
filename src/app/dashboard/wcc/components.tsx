import Link from "next/link";

type NoticeTone = "safe" | "warning";

export function WccNotice({ children, tone = "safe" }: { children: React.ReactNode; tone?: NoticeTone }) {
  const toneClasses = tone === "warning" ? "border-amber-400/40 bg-amber-400/10 text-amber-100" : "border-slate-700 bg-slate-900 text-slate-300";
  return <div className={`mt-6 rounded-2xl border p-4 text-sm ${toneClasses}`}>{children}</div>;
}

export function WccEmptyState({ title, description, actionHref, actionLabel }: { title: string; description: string; actionHref?: string; actionLabel?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-950/60 p-6 text-sm text-slate-400">
      <p className="font-semibold text-slate-200">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="mt-4 inline-flex rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300 hover:border-emerald-400 hover:text-emerald-200">
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export function WccBackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">← {children}</Link>;
}

export function WccInlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="font-semibold text-emerald-300 hover:underline">{children}</Link>;
}

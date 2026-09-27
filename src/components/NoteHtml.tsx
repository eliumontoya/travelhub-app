import { sanitizeNote } from "@/lib/sanitize";

const BASE_CLASS =
  "space-y-1 overflow-x-auto text-sm [&_a]:underline [&_a]:break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:ml-1 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_blockquote]:rounded-xl [&_blockquote]:border [&_blockquote]:border-[var(--operator-border)] [&_blockquote]:bg-[var(--operator-surface-subtle)] [&_blockquote]:px-3 [&_blockquote]:py-2 [&_blockquote]:italic [&_pre]:whitespace-pre-wrap [&_code]:rounded [&_code]:bg-[var(--operator-surface-subtle)] [&_code]:px-1 [&_code]:dark:bg-[var(--operator-brand)] [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:border [&_th]:border-[var(--operator-border)] [&_th]:bg-[var(--operator-canvas)] [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_td]:border [&_td]:border-[var(--operator-border)] [&_td]:px-2 [&_td]:py-1 [&_th]:dark:border-[var(--operator-border)] [&_th]:dark:bg-[var(--operator-brand)] [&_td]:dark:border-[var(--operator-border)]";

export function NoteHtml({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const safe = sanitizeNote(html);
  if (!safe) return null;
  return (
    <div
      className={`${BASE_CLASS} ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

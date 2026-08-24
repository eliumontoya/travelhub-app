import { sanitizeNote } from "@/lib/sanitize";

const BASE_CLASS =
  "space-y-1 text-sm [&_a]:underline [&_a]:break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:ml-1 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:whitespace-pre-wrap [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:dark:bg-gray-800";

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

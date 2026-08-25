import { sanitizeNote } from "@/lib/sanitize";

const BASE_CLASS =
  "space-y-1 overflow-x-auto text-sm [&_a]:underline [&_a]:break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:ml-1 [&_strong]:font-semibold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_pre]:whitespace-pre-wrap [&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:dark:bg-gray-800 [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_td]:border [&_td]:border-gray-300 [&_td]:px-2 [&_td]:py-1 [&_th]:dark:border-gray-700 [&_th]:dark:bg-gray-800 [&_td]:dark:border-gray-700";

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

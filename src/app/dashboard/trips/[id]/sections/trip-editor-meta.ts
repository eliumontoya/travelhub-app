export const statusMeta: Record<
  "draft" | "published" | "archived",
  { label: string; color: string }
> = {
  draft: { label: "Borrador", color: "border border-[#f0bd79]/45 bg-[#5c123e] text-[#f7dfbc]" },
  published: { label: "Publicado", color: "border border-[#f0bd79]/45 bg-[#f0bd79] text-[#4a1834]" },
  archived: { label: "Archivado", color: "border border-[#f0bd79]/35 bg-[#321426] text-[#f7dfbc]" },
};

/** Inclusive day count for a trip date range; null when the range is invalid. */
export function countDaysInRange(startDate: string, endDate: string): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

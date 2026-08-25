import type { Trip } from "@/types";

export function isTravelerTripVisible(
  status: Trip["status"],
  tripId: string,
  previewToken: string | null | undefined
): boolean {
  return status === "published" || (status === "draft" && previewToken === tripId);
}

export function travelerPreviewHref(slug: string, tripId: string, status: Trip["status"]): string {
  if (status === "draft") return `/t/${slug}?preview=${encodeURIComponent(tripId)}`;
  return `/t/${slug}`;
}

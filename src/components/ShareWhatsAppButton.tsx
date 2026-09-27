"use client";

export function ShareWhatsAppButton({ slug, title }: { slug: string; title: string }) {
  function handleShare() {
    const url = `${window.location.origin}/t/${slug}`;
    const message = `${title}: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className="rounded-lg border border-[var(--operator-border)] px-4 py-2 text-sm font-medium text-[var(--operator-ink)] hover:bg-[var(--operator-canvas)] dark:border-[var(--operator-border)] dark:text-[var(--operator-ink-subtle)] dark:hover:bg-[var(--operator-brand)]"
    >
      Compartir por WhatsApp
    </button>
  );
}

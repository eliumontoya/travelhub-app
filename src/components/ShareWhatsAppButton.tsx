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
      className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      Compartir por WhatsApp
    </button>
  );
}

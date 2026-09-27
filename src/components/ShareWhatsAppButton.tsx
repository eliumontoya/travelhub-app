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
      className="rounded-lg border border-white/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(27,8,19,0.12)] transition hover:border-[#f0bd79]/70 hover:bg-[#fffdfb] hover:text-[#4a1834] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0bd79]"
    >
      Compartir por WhatsApp
    </button>
  );
}

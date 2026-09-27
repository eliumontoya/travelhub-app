"use client";

import { useState } from "react";
import QRCode from "qrcode";

export function CopyUrlButtonClient({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  function publicUrl() {
    return `${window.location.origin}/t/${slug}`;
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(publicUrl());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function handleToggleQr() {
    if (!qrDataUrl) {
      const dataUrl = await QRCode.toDataURL(publicUrl(), { width: 240, margin: 1 });
      setQrDataUrl(dataUrl);
    }
    setShowQr((v) => !v);
  }

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleCopy}
        className="rounded-lg border border-[#f0bd79]/55 bg-[#fffdfb] px-4 py-2 text-sm font-semibold text-[#4a1834] shadow-[0_8px_18px_rgba(27,8,19,0.18)] transition hover:bg-[#f7dfbc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0bd79]"
      >
        {copied ? "¡Copiado!" : "Copiar URL"}
      </button>
      <button
        type="button"
        onClick={handleToggleQr}
        className="rounded-lg border border-white/60 bg-white/10 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(27,8,19,0.12)] transition hover:border-[#f0bd79]/70 hover:bg-[#fffdfb] hover:text-[#4a1834] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f0bd79]"
      >
        QR
      </button>

      {showQr && qrDataUrl && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border border-[var(--operator-border)] bg-white p-4 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR del itinerario" width={200} height={200} className="mx-auto" />
          <a
            href={qrDataUrl}
            download={`${slug}-qr.png`}
            className="mt-2 block text-center text-sm text-[var(--operator-brand)] hover:underline"
          >
            Descargar PNG
          </a>
        </div>
      )}
    </div>
  );
}

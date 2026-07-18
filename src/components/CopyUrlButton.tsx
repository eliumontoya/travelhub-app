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
        onClick={handleCopy}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        {copied ? "¡Copiado!" : "Copiar URL"}
      </button>
      <button
        onClick={handleToggleQr}
        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        QR
      </button>

      {showQr && qrDataUrl && (
        <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="QR del itinerario" width={200} height={200} className="mx-auto" />
          <a
            href={qrDataUrl}
            download={`${slug}-qr.png`}
            className="mt-2 block text-center text-sm text-blue-600 hover:underline"
          >
            Descargar PNG
          </a>
        </div>
      )}
    </div>
  );
}

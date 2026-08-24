"use client";

import { useRef, useTransition } from "react";

export function TripCoverImage({
  coverImageUrl,
  coversEnabled,
  onUpload,
  onRemove,
}: {
  coverImageUrl: string | undefined;
  coversEnabled: boolean;
  onUpload: (formData: FormData) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();

  function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      await onUpload(formData);
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRemove() {
    if (!confirm("¿Quitar la imagen de portada?")) return;
    startTransition(async () => {
      await onRemove();
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-medium text-gray-700">Imagen de portada</h3>

      {coverImageUrl ? (
        <div className="relative mt-3 overflow-hidden rounded-lg border border-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverImageUrl}
            alt="Portada del viaje"
            className="h-40 w-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="absolute right-2 top-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white hover:bg-black/75 disabled:opacity-50"
          >
            Quitar
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-400">Sin imagen de portada.</p>
      )}

      {coversEnabled ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="text-sm" />
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {coverImageUrl ? "Cambiar portada" : "Subir portada"}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-400">Configura Supabase para subir la portada.</p>
      )}
    </div>
  );
}

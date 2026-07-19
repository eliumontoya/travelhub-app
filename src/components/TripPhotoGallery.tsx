"use client";

import { useRef, useTransition } from "react";
import { TripPhoto } from "@/types";

type PhotoWithUrl = TripPhoto & { url: string | null };

export function TripPhotoGallery({
  photos,
  photosEnabled,
  onUpload,
  onDelete,
}: {
  photos: PhotoWithUrl[];
  photosEnabled: boolean;
  onUpload: (formData: FormData) => Promise<void>;
  onDelete: (photoId: string) => Promise<void>;
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

  function handleDelete(photoId: string) {
    if (!confirm("¿Eliminar esta foto?")) return;
    startTransition(async () => {
      await onDelete(photoId);
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h3 className="mb-3 font-semibold text-gray-900">Galería de fotos</h3>

      {photos.length > 0 && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-100">
              {photo.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo.url} alt={photo.fileName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100 text-xs text-gray-400">
                  {photo.fileName}
                </div>
              )}
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                disabled={isPending}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}

      {photosEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" className="text-sm" />
          <button
            type="button"
            onClick={handleUpload}
            disabled={isPending}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
          >
            Subir foto
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400">Configura Supabase para subir fotos.</p>
      )}
    </div>
  );
}

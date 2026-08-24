"use client";

import { useActionState, useState } from "react";
import { SiteSettings } from "@/types";
import { updateSettingsAction } from "./actions";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, isPending] = useActionState(updateSettingsAction, null);
  const [preview, setPreview] = useState<string | null>(settings.logoUrl ?? null);

  return (
    <form action={formAction} encType="multipart/form-data" className="max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Email de contacto</label>
        <input
          type="email"
          name="email"
          defaultValue={settings.email}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Teléfono de contacto</label>
        <input
          type="text"
          name="phone"
          defaultValue={settings.phone}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Nombre de la agencia</label>
        <input
          type="text"
          name="agencyName"
          defaultValue={settings.agencyName ?? ""}
          placeholder="Viajes Example"
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Logo</label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Logo actual"
            className="mb-2 h-16 w-auto rounded-lg border border-gray-200 bg-white object-contain p-1"
          />
        )}
        <input
          type="file"
          name="logo"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPreview(URL.createObjectURL(file));
          }}
          className="mt-1 w-full text-sm"
        />
        <p className="mt-1 text-xs text-gray-500">
          Sube una imagen (requiere Supabase configurado). O pega una URL manual:
        </p>
        <input
          type="url"
          name="logoUrl"
          defaultValue={settings.logoUrl ?? ""}
          placeholder="https://…/logo.png"
          onChange={(e) => setPreview(e.target.value || null)}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}

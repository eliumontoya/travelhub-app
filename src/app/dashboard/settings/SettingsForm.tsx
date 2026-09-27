"use client";

import { useActionState, useState } from "react";
import { SiteSettings } from "@/types";
import { updateSettingsAction } from "./actions";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, isPending] = useActionState(updateSettingsAction, null);
  const [preview, setPreview] = useState<string | null>(settings.logoUrl ?? null);

  return (
    <form action={formAction} encType="multipart/form-data" className="max-w-2xl space-y-5 rounded-2xl border border-[var(--operator-border)] bg-white/94 p-5 shadow-[0_18px_42px_rgba(81,0,52,0.07)] sm:p-6">
      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Email de contacto</label>
        <input
          type="email"
          name="email"
          defaultValue={settings.email}
          required
          className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white px-4 py-3 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Teléfono de contacto</label>
        <input
          type="text"
          name="phone"
          defaultValue={settings.phone}
          required
          className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white px-4 py-3 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Nombre de la agencia</label>
        <input
          type="text"
          name="agencyName"
          defaultValue={settings.agencyName ?? ""}
          placeholder="Viajes Example"
          className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white px-4 py-3 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[var(--operator-ink)]">Logo</label>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Logo actual"
            className="mb-2 h-16 w-auto rounded-lg border border-[var(--operator-border)] bg-white object-contain p-1"
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
          className="mt-2 w-full text-sm text-[var(--operator-ink-muted)] file:mr-3 file:rounded-xl file:border-0 file:bg-[var(--operator-brand)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white"
        />
        <p className="mt-1 text-xs text-[var(--operator-ink-muted)]">
          Sube una imagen (requiere Supabase configurado). O pega una URL manual:
        </p>
        <input
          type="url"
          name="logoUrl"
          defaultValue={settings.logoUrl ?? ""}
          placeholder="https://…/logo.png"
          onChange={(e) => setPreview(e.target.value || null)}
          className="mt-2 w-full rounded-xl border border-[var(--operator-border)] bg-white px-4 py-3 text-sm text-[var(--operator-ink)] outline-none focus:border-[var(--operator-brand)] focus:ring-2 focus:ring-[var(--operator-brand)]/15"
        />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-xl bg-[var(--operator-brand)] px-5 py-3 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
      >
        Guardar
      </button>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { SiteSettings } from "@/types";
import { updateSettingsAction } from "./actions";

export function SettingsForm({ settings }: { settings: SiteSettings }) {
  const [state, formAction, isPending] = useActionState(updateSettingsAction, null);

  return (
    <form action={formAction} className="max-w-md space-y-4">
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

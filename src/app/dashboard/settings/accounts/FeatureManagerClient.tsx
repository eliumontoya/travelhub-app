"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useCallback } from "react";
import type { AccountProfile, Feature } from "@/types";
import { FEATURE_DEFINITIONS, isFeature } from "@/lib/auth/features";
import { updateProfileFeaturesAction } from "./actions";

type FeaturesByProfile = Record<string, Feature[]>;

export function FeatureManagerClient({
  profiles,
}: {
  profiles: AccountProfile[];
}) {
  const router = useRouter();
  const [localFeatures, setLocalFeatures] = useState<FeaturesByProfile>(() => {
    const initial: FeaturesByProfile = {};
    for (const p of profiles) {
      initial[p.id] = [...p.features];
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [, startTransition] = useTransition();

  const hasChanges = profiles.some((p) => {
    const local = localFeatures[p.id] ?? [];
    const server = p.features;
    if (local.length !== server.length) return true;
    return local.some((f, i) => f !== server[i]);
  });

  const handleToggle = useCallback(
    (profileId: string, feature: Feature, checked: boolean) => {
      setSaveSuccess(false);
      setSaveError(null);
      setLocalFeatures((prev) => {
        const current = prev[profileId] ?? [];
        const next = checked
          ? Array.from(new Set([...current, feature]))
          : current.filter((f) => f !== feature);
        return { ...prev, [profileId]: next.filter(isFeature) };
      });
    },
    [],
  );

  const handleSave = useCallback(() => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    startTransition(async () => {
      try {
        const changedProfiles = profiles.filter((p) => {
          const local = localFeatures[p.id] ?? [];
          const server = p.features;
          if (local.length !== server.length) return true;
          return local.some((f, i) => f !== server[i]);
        });

        const results = await Promise.all(
          changedProfiles.map((p) =>
            updateProfileFeaturesAction(p.id, localFeatures[p.id] ?? []),
          ),
        );

        const failed = results.find((r) => !r.ok);
        if (failed && !failed.ok) {
          setSaveError(failed.error);
          return;
        }

        setSaveSuccess(true);
        router.refresh();
      } catch {
        setSaveError("Error al guardar los permisos.");
      } finally {
        setSaving(false);
      }
    });
  }, [profiles, localFeatures, router]);

  if (profiles.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-[var(--operator-border)] bg-white/94 px-4 py-6 text-sm text-[var(--operator-ink-muted)]">
        Aún no hay cuentas registradas para administrar.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-2xl border border-[var(--operator-border)] bg-white/94 shadow-[0_18px_42px_rgba(81,0,52,0.07)]">
        <table className="min-w-full divide-y divide-[var(--operator-border)] text-sm">
          <thead className="bg-[var(--operator-surface-subtle)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--operator-ink-muted)]">
            <tr>
              <th scope="col" className="px-4 py-3">
                Cuenta
              </th>
              <th scope="col" className="px-4 py-3">
                Rol
              </th>
              <th scope="col" className="px-4 py-3">
                Agente vinculado
              </th>
              {FEATURE_DEFINITIONS.map((def) => (
                <th
                  key={def.feature}
                  scope="col"
                  className="px-4 py-3 text-center"
                >
                  {def.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--operator-border)]">
            {profiles.map((profile) => {
              const features = localFeatures[profile.id] ?? profile.features;
              return (
                <tr key={profile.id}>
                  <td className="px-4 py-3 font-semibold text-[var(--operator-brand)]">
                    {profile.email ?? profile.id}
                  </td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">
                    {profile.role === "admin" ? "Admin" : "Agente"}
                  </td>
                  <td className="px-4 py-3 text-[var(--operator-ink-muted)]">
                    {profile.travelAgentName ?? "—"}
                  </td>
                  {FEATURE_DEFINITIONS.map((def) => {
                    const checked = features.includes(def.feature);
                    return (
                      <td key={def.feature} className="px-4 py-3 text-center">
                        <label className="inline-flex items-center justify-center">
                          <input
                            type="checkbox"
                            aria-label={`${def.label} para ${profile.email ?? profile.id}`}
                            checked={checked}
                            disabled={saving}
                            onChange={(event) =>
                              handleToggle(
                                profile.id,
                                def.feature,
                                event.target.checked,
                              )
                            }
                            className="h-4 w-4 rounded border-[var(--operator-border)] text-[var(--operator-brand)] focus:ring-[var(--operator-brand)] disabled:opacity-50"
                          />
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="rounded-xl bg-[var(--operator-brand)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--operator-shadow-action)] hover:bg-[var(--operator-brand-strong)] disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        {saveSuccess && (
          <p className="text-sm text-[var(--operator-brand)]">
            Permisos guardados.
          </p>
        )}
        {saveError && (
          <p className="text-sm text-[var(--operator-coral)]">{saveError}</p>
        )}
        {!hasChanges && !saveError && !saveSuccess && (
          <p className="text-sm text-[var(--operator-ink-muted)]">
            Sin cambios pendientes.
          </p>
        )}
      </div>
    </div>
  );
}

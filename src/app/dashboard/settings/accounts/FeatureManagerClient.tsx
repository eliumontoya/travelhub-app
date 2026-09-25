"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { AccountProfile, Feature } from "@/types";
import { FEATURE_DEFINITIONS, isFeature } from "@/lib/auth/features";
import { updateProfileFeaturesAction } from "./actions";

// Admin-only table that toggles each profile's `features` set against the
// single-source-of-truth `FEATURE_DEFINITIONS`. The checkbox set is derived
// solely from `FEATURE_DEFINITIONS`, so the UI cannot emit a feature value
// the catalog does not know about — the server action's defensive filter
// (`filterFeatures`) is the second wall.
export function FeatureManagerClient({
  profiles,
}: {
  profiles: AccountProfile[];
}) {
  const router = useRouter();
  const [pendingProfileId, setPendingProfileId] = useState<string | null>(null);
  const [errorByProfile, setErrorByProfile] = useState<Record<string, string>>(
    {},
  );
  const [, startTransition] = useTransition();

  function handleToggle(
    profileId: string,
    currentFeatures: Feature[],
    feature: Feature,
    checked: boolean,
  ) {
    const next = checked
      ? Array.from(new Set([...currentFeatures, feature]))
      : currentFeatures.filter((f) => f !== feature);
    // Only known catalog values reach the server — defensive trim, even though
    // we already filtered the input set, to keep this client self-contained.
    const sanitized = next.filter(isFeature);

    setErrorByProfile((prev) => {
      const nextMap = { ...prev };
      delete nextMap[profileId];
      return nextMap;
    });
    setPendingProfileId(profileId);

    startTransition(async () => {
      try {
        const result = await updateProfileFeaturesAction(profileId, sanitized);
        if (!result.ok) {
          setErrorByProfile((prev) => ({ ...prev, [profileId]: result.error }));
          return;
        }
        router.refresh();
      } catch {
        setErrorByProfile((prev) => ({
          ...prev,
          [profileId]: "Error al guardar los permisos.",
        }));
      } finally {
        setPendingProfileId(null);
      }
    });
  }

  if (profiles.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Aún no hay cuentas registradas para administrar.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
        <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:bg-gray-950 dark:text-gray-300">
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
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {profiles.map((profile) => {
            const isPending = pendingProfileId === profile.id;
            const error = errorByProfile[profile.id];
            return (
              <tr key={profile.id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                  <div>{profile.id}</div>
                  {error ? (
                    <p className="mt-1 text-xs font-normal text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {profile.role === "admin" ? "Admin" : "Agente"}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {profile.travelAgentId ?? "—"}
                </td>
                {FEATURE_DEFINITIONS.map((def) => {
                  const checked = profile.features.includes(def.feature);
                  return (
                    <td key={def.feature} className="px-4 py-3 text-center">
                      <label className="inline-flex items-center justify-center">
                        <input
                          type="checkbox"
                          aria-label={`${def.label} para ${profile.id}`}
                          checked={checked}
                          disabled={isPending}
                          onChange={(event) =>
                            handleToggle(
                              profile.id,
                              profile.features,
                              def.feature,
                              event.target.checked,
                            )
                          }
                          className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
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
  );
}

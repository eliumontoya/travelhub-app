import { getIntegrationsStatus } from "@/lib/integrations";

export function IntegrationsStatusCard() {
  const integrations = getIntegrationsStatus();

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Integraciones opcionales</h2>
      <ul className="mt-2 space-y-1.5">
        {integrations.map((integration) => (
          <li key={integration.id} className="flex items-center gap-2 text-sm">
            <span className={integration.configured ? "text-green-600 dark:text-green-400" : "text-gray-300 dark:text-gray-600"}>
              {integration.configured ? "✓" : "✗"}
            </span>
            <span className={integration.configured ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"}>
              {integration.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

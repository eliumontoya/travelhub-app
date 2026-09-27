import { getIntegrationsStatus } from "@/lib/integrations";

export function IntegrationsStatusCard() {
  const integrations = getIntegrationsStatus();

  return (
    <div className="rounded-xl border border-[var(--operator-border)] bg-white p-4 shadow-sm dark:border-[var(--operator-border)] dark:bg-[var(--operator-brand-strong)]">
      <h2 className="text-sm font-semibold text-[var(--operator-brand)] dark:text-[var(--operator-brand)]">Integraciones opcionales</h2>
      <ul className="mt-2 space-y-1.5">
        {integrations.map((integration) => (
          <li key={integration.id} className="flex items-center gap-2 text-sm">
            <span className={integration.configured ? "text-green-600 dark:text-green-400" : "text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]"}>
              {integration.configured ? "✓" : "✗"}
            </span>
            <span className={integration.configured ? "text-[var(--operator-ink)] dark:text-[var(--operator-ink-subtle)]" : "text-[var(--operator-ink-subtle)] dark:text-[var(--operator-ink-muted)]"}>
              {integration.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

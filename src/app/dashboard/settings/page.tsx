import { getSiteSettings } from "@/lib/data";
import { requireFeature } from "@/lib/auth/roles";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  await requireFeature("settings");
  const settings = await getSiteSettings();

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <section className="mb-7 overflow-hidden rounded-2xl bg-[var(--operator-brand)] px-5 py-6 text-white shadow-[var(--operator-shadow-panel)] sm:px-7">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Ajustes</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Configuración</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/82">Datos públicos de la agencia, contacto y marca del portal del viajero.</p>
      </section>
      <SettingsForm settings={settings} />
    </main>
  );
}

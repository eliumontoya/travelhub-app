import { getSiteSettings } from "@/lib/data";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const settings = await getSiteSettings();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Configuración</h1>
      <SettingsForm settings={settings} />
    </main>
  );
}

import Link from "next/link";
import { ALL_CLIENTS_PAGE_SIZE, getClients } from "@/lib/data";
import { requireFeature } from "@/lib/auth/roles";
import { NewVisaForm } from "./NewVisaForm";

export default async function NewVisaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireFeature("visas");
  const [{ items: clients }, { error }] = await Promise.all([
    getClients({ pageSize: ALL_CLIENTS_PAGE_SIZE }),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <Link
        href="/dashboard/visas"
        className="text-sm text-[var(--operator-ink-muted)] hover:underline"
      >
        ← Volver
      </Link>

      <h1 className="mt-4 mb-2 text-2xl font-bold text-[var(--operator-brand)]">Nueva visa</h1>
      <p className="mb-6 text-sm text-[var(--operator-ink-muted)]">
        Crea una solicitud de visa con país/consulado, tipo, fecha límite y precio.
        Podrás asignar clientes y adjuntar documentos después.
      </p>

      <NewVisaForm clients={clients} error={error} />
    </main>
  );
}

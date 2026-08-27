import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Eliminación de Datos | TravelHub",
  description: "Instrucciones para solicitar la eliminación de datos en TravelHub.",
};

const lastUpdated = "26 de agosto de 2026";

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          TravelHub
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Instrucciones para Eliminación de Datos
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Última actualización: {lastUpdated}
        </p>

        <div className="mt-8 space-y-8 leading-7 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Cómo solicitar la eliminación
            </h2>
            <p className="mt-3">
              Si deseas que eliminemos datos asociados a tu uso de TravelHub o
              a conversaciones enviadas por canales como WhatsApp, envía un
              correo a
              <a
                className="ml-1 font-medium text-sky-700 underline underline-offset-4 dark:text-sky-300"
                href="mailto:privacy@app.xtravelhub.com"
              >
                privacy@app.xtravelhub.com
              </a>
              con el asunto “Solicitud de eliminación de datos”.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Información que debes incluir
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-6">
              <li>Nombre completo.</li>
              <li>Correo o teléfono asociado a la conversación o itinerario.</li>
              <li>Una descripción breve de los datos que deseas eliminar.</li>
              <li>
                Cualquier referencia útil, como fecha aproximada del viaje o de
                la conversación.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Proceso
            </h2>
            <p className="mt-3">
              Revisaremos tu solicitud, validaremos la identidad o relación con
              los datos solicitados y eliminaremos o anonimizaremos la
              información aplicable, salvo que debamos conservarla por motivos
              legales, contables, de seguridad o resolución de disputas.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Tiempo de respuesta
            </h2>
            <p className="mt-3">
              Normalmente respondemos dentro de un plazo razonable después de
              recibir la información necesaria para procesar la solicitud. Si
              necesitamos datos adicionales para ubicar la información, te lo
              solicitaremos por correo.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              Contacto
            </h2>
            <p className="mt-3">
              Para dudas sobre privacidad o eliminación de datos, escribe a
              <a
                className="ml-1 font-medium text-sky-700 underline underline-offset-4 dark:text-sky-300"
                href="mailto:privacy@app.xtravelhub.com"
              >
                privacy@app.xtravelhub.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

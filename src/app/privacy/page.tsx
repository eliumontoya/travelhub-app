import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidad | TravelHub",
  description: "Aviso de privacidad de TravelHub para clientes y usuarios.",
};

const lastUpdated = "26 de agosto de 2026";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <article className="mx-auto max-w-3xl rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800 sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          TravelHub
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Aviso de Privacidad
        </h1>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Última actualización: {lastUpdated}
        </p>

        <div className="mt-8 space-y-8 leading-7 text-slate-700 dark:text-slate-300">
          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              1. Responsable
            </h2>
            <p className="mt-3">
              TravelHub es una aplicación privada de gestión de itinerarios y
              comunicación para servicios de viaje. Para cualquier solicitud de
              privacidad o datos personales, puedes contactarnos en:
              <a
                className="ml-1 font-medium text-sky-700 underline underline-offset-4 dark:text-sky-300"
                href="mailto:privacy@app.xtravelhub.com"
              >
                privacy@app.xtravelhub.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              2. Datos que podemos recopilar
            </h2>
            <p className="mt-3">
              Podemos recopilar datos necesarios para preparar, administrar y
              compartir itinerarios de viaje, incluyendo nombre, datos de
              contacto, preferencias de viaje, información de reservaciones,
              documentos relacionados con el viaje y mensajes enviados por los
              canales de atención habilitados, como WhatsApp.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              3. Finalidades de uso
            </h2>
            <p className="mt-3">
              Usamos la información para crear y gestionar itinerarios,
              compartir detalles del viaje con el cliente, dar seguimiento a
              solicitudes, enviar recordatorios o actualizaciones relevantes y
              mantener un historial operativo de viajes y conversaciones.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              4. Compartición de datos
            </h2>
            <p className="mt-3">
              No vendemos datos personales. Podemos compartir información solo
              cuando sea necesario para prestar el servicio solicitado, cumplir
              obligaciones legales o usar proveedores tecnológicos que operan la
              aplicación, el almacenamiento, el envío de mensajes o el hosting.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              5. Conservación y seguridad
            </h2>
            <p className="mt-3">
              Conservamos los datos durante el tiempo necesario para operar el
              servicio, atender solicitudes y cumplir obligaciones aplicables.
              Aplicamos controles razonables de seguridad para proteger la
              información contra acceso, uso o divulgación no autorizados.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              6. Derechos y solicitudes
            </h2>
            <p className="mt-3">
              Puedes solicitar acceso, corrección, eliminación u oposición al
              uso de tus datos escribiendo a
              <a
                className="ml-1 font-medium text-sky-700 underline underline-offset-4 dark:text-sky-300"
                href="mailto:privacy@app.xtravelhub.com"
              >
                privacy@app.xtravelhub.com
              </a>
              . También puedes consultar las instrucciones de eliminación en
              <a
                className="ml-1 font-medium text-sky-700 underline underline-offset-4 dark:text-sky-300"
                href="/data-deletion"
              >
                /data-deletion
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-slate-950 dark:text-white">
              7. Cambios a este aviso
            </h2>
            <p className="mt-3">
              Podemos actualizar este aviso para reflejar cambios operativos,
              legales o tecnológicos. La versión vigente se publicará en esta
              página.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}

export type ChangelogEntry = {
  date: string;
  title: string;
  description: string;
};

/**
 * Lista autoritativa de novedades, ordenada de más reciente a más antigua.
 * Al agregar una entrada, insertarla al inicio del arreglo.
 */
export const changelog: ChangelogEntry[] = [
  {
    date: "2026-07-15",
    title: "Tags recientes en el combobox de etiquetas",
    description:
      "El selector de etiquetas ahora muestra las tags usadas más recientemente al abrir el dropdown sin escribir nada, para reutilizarlas más rápido.",
  },
  {
    date: "2026-07-08",
    title: "Creación de clientes en línea",
    description:
      "Se puede crear un cliente nuevo directamente desde el buscador de clientes de un viaje, sin salir del flujo para ir a la sección de clientes.",
  },
  {
    date: "2026-06-30",
    title: "Etiquetas para viajes",
    description:
      "Cada viaje admite ahora cero o varias etiquetas (tags) para clasificarlo y encontrarlo más fácilmente en el listado.",
  },
  {
    date: "2026-06-10",
    title: "Relación de clientes con viajes",
    description:
      "Se agregó la relación muchos a muchos entre clientes y viajes, con ficha de cliente que incluye historial de viajes asociados.",
  },
  {
    date: "2026-05-28",
    title: "Menú de perfil y configuración del sitio",
    description:
      "Nuevo menú de perfil en el panel con acceso a la configuración de contacto del sitio.",
  },
];

// Único slugify del proyecto: usado tanto para el slug de viajes
// (src/app/dashboard/trips/new/actions.ts) como para el slug público de
// clientes (src/lib/data.ts). No duplicar esta lógica en otro archivo.
export function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/**
 * Migration: Normalizar nombres compuestos de clientes.
 *
 * Problema: algunos clientes tienen nombres como "Ana & Pedro" o "Ana y Pedro"
 * como un solo registro, y además existen registros separados para "Ana" y "Pedro".
 * Al mostrar clientes asignados a un viaje, los nombres se duplican.
 *
 * Este script:
 * 1. Busca clientes cuyo nombre contenga " & " o " y "
 * 2. Divide en palabras individuales
 * 3. Para cada palabra, busca si ya existe un cliente con ese nombre
 * 4. Si existe, reasigna las referencias (trip_clients, trips.client_id)
 * 5. Si no existe, crea el cliente primero
 * 6. Elimina el registro compuesto original
 *
 * Uso:
 *   npx tsx --env-file .env.local scripts/normalize-client-names.ts
 *
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local. Usa fetch directamente
 * (REST API) para evitar dependencia de WebSocket nativo.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  "apikey": serviceRoleKey,
  "Authorization": `Bearer ${serviceRoleKey}`,
  "Prefer": "return=representation",
};

const BASE = `${supabaseUrl}/rest/v1`;

const SEPARATORS = /\s+[&yY]\s+/;

function splitName(name: string): string[] {
  return name
    .split(SEPARATORS)
    .flatMap((part) => part.split(/\s+y\s+/i))
    .map((s) => s.trim())
    .filter(Boolean);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function api(path: string, options: RequestInit = {}) {
  const url = `${BASE}/${path}`;
  const res = await fetch(url, { ...options, headers: { ...headers, ...options.headers as Record<string, string> } });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  console.log("🔍 Buscando clientes con nombres compuestos...\n");

  // Obtener todos los clientes
  const allClients: { id: string; name: string }[] = await api("clients?select=id,name");

  const compound = allClients.filter((c) => SEPARATORS.test(c.name));
  console.log(`Total clientes: ${allClients.length}`);
  console.log(`Clientes con nombre compuesto: ${compound.length}\n`);

  if (compound.length === 0) {
    console.log("✅ No hay nombres compuestos que normalizar.");
    return;
  }

  // Mapa: nombre normalizado (lowercase) -> id del cliente existente
  const nameToId = new Map<string, string>();
  for (const c of allClients) {
    const key = c.name.toLowerCase().trim();
    if (!nameToId.has(key)) nameToId.set(key, c.id);
  }

  let created = 0;
  let reassigned = 0;
  let deleted = 0;

  for (const client of compound) {
    const words = splitName(client.name);
    const resolvedIds: string[] = [];

    console.log(`\n📦 "${client.name}" (${client.id}) → [${words.join(", ")}]`);

    for (const word of words) {
      const key = word.toLowerCase();
      const existingId = nameToId.get(key);

      if (existingId && existingId !== client.id) {
        resolvedIds.push(existingId);
      } else if (existingId === client.id) {
        resolvedIds.push(client.id);
      } else {
        // Crear nuevo cliente
        const [newClient] = await api("clients", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({ name: word, slug: slugify(word) }),
        });
        nameToId.set(key, newClient.id);
        resolvedIds.push(newClient.id);
        created++;
        console.log(`   ➕ "${word}" → ${newClient.id}`);
      }
    }

    // Leer trip_clients del cliente compuesto
    const links: { trip_id: string }[] = await api(
      `trip_clients?client_id=eq.${client.id}&select=trip_id`,
    );

    // Reasignar trip_clients
    for (const link of links) {
      for (const targetId of resolvedIds) {
        await api("trip_clients", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ trip_id: link.trip_id, client_id: targetId }),
        });
        reassigned++;
      }
    }

    // Actualizar trips.client_id (espejo de compatibilidad)
    const firstId = resolvedIds[0];
    await api(`trips?client_id=eq.${client.id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ client_id: firstId }),
    });

    // Eliminar vínculos compuestos de trip_clients
    await api(`trip_clients?client_id=eq.${client.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });

    // Eliminar el cliente compuesto
    await api(`clients?id=eq.${client.id}`, {
      method: "DELETE",
      headers: { Prefer: "return=minimal" },
    });
    deleted++;
    console.log(`   🗑️  Eliminado`);
  }

  // Verificación final
  console.log("\n═══════════════════════════════════════");
  console.log("📊 Resumen:");
  console.log(`   Creados:   ${created}`);
  console.log(`   Reasignaciones: ${reassigned}`);
  console.log(`   Eliminados: ${deleted}`);
  console.log("═══════════════════════════════════════\n");

  // Verificar que no queden nombres compuestos
  const remaining: { id: string; name: string }[] = await api("clients?select=id,name&order=name.asc");
  const stillCompound = remaining.filter((c) => SEPARATORS.test(c.name));
  if (stillCompound.length > 0) {
    console.log("⚠️  Aún quedan nombres compuestos:");
    for (const c of stillCompound) {
      console.log(`   - ${c.name} (${c.id})`);
    }
  } else {
    console.log("✅ No quedan nombres compuestos.");
  }
}

main().catch((err) => {
  console.error("💥 Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});

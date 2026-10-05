# Feature: actualizar-pruebas-e2e (issue #396)

Cobertura e2e de los casos de uso principales: creación de viaje y sus
features, visibilidad draft→publicado para el viajero, y limpieza de tests
ociosos.

Referencias:
- Issue: https://github.com/eliumontoya/travelhub-app/issues/396
- Informe de brechas: scout `gentle-ai-explore` (task muukqpsp-1-09fq,
  2026). Resumen: sin e2e de creación real de viaje; sin e2e de draft 404 ni
  transición publish→visible; 4 specs de `e2e/preview` son smoke `<500` sin
  aserciones de comportamiento (ociosos junto con `login.spec` trivial).

Decisiones:
- Rama: `eliumontoya/actualizar-pruebas-e2e` (worktree existente).
- El draft "Aventura en Cancún" (`cancun-gomez-2026`) del seed se publica en
  el test; `db:reset` lo restaura para corridas siguientes.
- c2 (Familia Gómez) no tiene PIN en el seed: la aserción "un cliente con
  sesión tampoco ve el draft" se hace con c1 (Ana Pérez, PIN `123456`), que
  por `trip-visibility.ts` tampoco debe ver borradores ajenos.

## Tareas

### T1 — Prueba e2e draft→publicado (visibilidad viajero)
- [x] Estado: completada (3 pasan, 1 fixme por bug #404)
- Nuevo spec `e2e/local/trip-visibility.spec.ts`:
  1. Anónimo y cliente con sesión NO ven `/t/cancun-gomez-2026` (draft) → UI
     "Itinerario no disponible" (la app responde 200 con el boundary
     not-found por streaming, no 404 HTTP).
  2. Agente publica (toggle UI) → anónimo y cliente ven el itinerario.
  3. Revertir a borrador vuelve a ocultarlo (deja el seed en draft).
  4. Caso preview token: `test.fixme` — descubre bug #404 (RLS bloquea la
     lectura del draft para el cliente anon de /t/[slug]; la "Vista previa
     borrador" nunca funciona). Issue: https://github.com/eliumontoya/travelhub-app/issues/404
- Verificación: spec verde en local (3 passed, 1 skipped/fixme), tsc limpio.
- Commit: (pendiente)

### T2 — Prueba e2e de creación de viaje con features principales
- [x] Estado: completada (2 tests pasan)
- Nuevo spec `e2e/local/create-trip.spec.ts` (Supabase real):
  1. Guardía cliente-side exige al menos un cliente (MinClientsGuard).
  2. Formulario real: título, fechas, viajeros, moneda, cliente c1 existente
     (combobox) + cliente nuevo creado en el form → redirect al editor.
  3. Itinerario: agregar día → item vuelo (metadata) → item nota;
     persistencia tras reload.
  4. Publicar (toggle) → anónimo ve el itinerario en /t/{slug} y el cliente
     c1 lo ve en su portal.
  5. Limpieza: vuelve a draft para dejar el seed estable.
- Notas: los campos de metadata del item dialog usan prefijo `metadata_`;
  "instructions" es un RichTextEditor (no textarea); el link "Vista previa"
  puede quedar stale tras publicar (se usa ensureTripStatus + pathname).
- Verificación: spec verde, tsc y eslint limpios.
- Commit: (pendiente)

### T3 — Limpieza de tests ociosos
- [ ] Estado: pendiente
- Eliminar specs smoke sin valor en `e2e/preview`: `create-trip.spec.ts`,
  `create-client.spec.ts`, `calendar-export.spec.ts`, `public-trip.spec.ts`.
- Endurecer `e2e/preview/login.spec.ts` (aserciones reales, no "cualquier
  texto").
- Evaluar test "rutas adyacentes" en `dashboard.spec.ts` (posible duplicado).
- Documentar la decisión en `Changes.md` / doc fuente correspondiente.
- Verificación: suite e2e local + compilación playwright.
- Commit: (pendiente)

### T4 — Verificación final y cierre
- [ ] Estado: pendiente
- Suite e2e local completa verde (`npm run test:e2e`).
- Lint + tsc limpios en archivos tocados.
- Resumen en el issue #396 (comentario) y cierre del doc ODD.

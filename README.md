# TravelHub

Plataforma web para agentes de viajes independientes. Permite crear, gestionar y compartir itinerarios de viaje con clientes, sin depender de herramientas de terceros.

## Que hace

- **Gestion de clientes**: alta, edicion, historial de viajes, tags, fuentes de referido, cumpleanos.
- **Armado de itinerarios**: viaje dia por dia con vuelos, hoteles, actividades, restaurantes, transporte y notas. Cada item lleva horarios, ubicacion, codigos de confirmacion y documentos adjuntos.
- **Vista publica del viaje**: el agente publica el itinerario y comparte una URL unica (`/t/{slug}`). El cliente ve su viaje completo sin necesidad de cuenta.
- **Portal del cliente**: login con email + PIN para que el cliente consulte sus viajes, suba documentos y vea el progreso de servicios.
- **Perfil publico del cliente**: pagina `/c/{slug}` con historial de viajes publicados.
- **Agentes de viaje**: soporte multi-agente con asignacion de viajes y roles (admin/agent).
- **Proveedores**: catalogo de proveedores con contacto, ubicacion y notas.
- **Calendario**: exportacion `.ics` para que el cliente agregue el viaje a su calendario personal.
- **Recordatorios por email**: envio automatico via Resend antes del inicio del viaje.
- **Estado de vuelos**: consulta manual del estado de un vuelo via Aviationstack.
- **WhatsApp AI Agent**: bot con clasificacion de intenciones, escalamiento a agente humano, base de conocimiento y observabilidad estructurada.
- **WCC (WhatsApp Control Center)**: panel en el dashboard para gestionar conversaciones, contactos, intenciones, escalamientos y base de conocimiento del agente WhatsApp.
- **Servicios y checklist**: flujo de solicitud de documentos al cliente con estados (uploaded, reviewed, processed, re_upload_requested).
- **MCP Server**: servidor Model Context Protocol integrado para herramientas externas.
- **Feedback**: los clientes pueden calificar y comentar sobre sus viajes.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Estilos | Tailwind CSS 4 |
| Base de datos | Postgres (Supabase) |
| Auth | Supabase Auth (email + password para agente; email + PIN para cliente) |
| Storage | Supabase Storage (bucket privado `trip-documents`) |
| Email | Resend |
| Vuelos | Aviationstack API |
| WhatsApp | `@chat-adapter/whatsapp` + AI SDK |
| Hosting | Vercel (deploy automatico en push a `main`) |
| Tests | Vitest (unit) + Playwright (E2E) |

## Arquitectura

```
Cliente (browser)
   |
   +-- /dashboard/**        (autenticado, agente de viajes)
   |     Server Components + Server Actions -> src/lib/data/* -> Supabase
   |
   +-- /client/**           (autenticado, cliente con PIN)
   |
   +-- /t/{slug}            (publico, sin login, RLS: solo published)
   |
   +-- /c/{slug}            (publico, historial de viajes del cliente)
   |
   +-- /api/whatsapp/**     (webhooks del agente WhatsApp)
   +-- /api/mcp/**          (MCP server)
   +-- /api/flight-status/  (consulta estado de vuelos)
   +-- /api/cron/**         (recordatorios automaticos)
```

No hay API REST propia. Las mutaciones usan Server Actions. La capa de datos (`src/lib/data/*`) esta separada por dominio y soporta modo dual: Supabase cuando esta configurado, mock data en memoria cuando no.

## Inicio rapido

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). La app funciona sin Supabase configurado (modo mock con datos de prueba).

Para conectar Supabase, copia las variables en `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Ver `SUPABASE_SETUP.md` para el paso a paso completo.

### Variables opcionales

| Variable | Efecto |
|----------|--------|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Autocomplete de ubicacion y mapa embebido |
| `RESEND_API_KEY` | Recordatorios automaticos por email |
| `FLIGHT_API_KEY` | Consulta de estado de vuelos |
| `CRON_SECRET` | Protege el endpoint de recordatorios |

## Scripts

```bash
npm run dev            # Servidor de desarrollo
npm run build          # Build de produccion
npm run lint           # ESLint
npm run test           # Tests unitarios (Vitest)
npm run test:e2e       # Tests E2E (Playwright, modo mock)
npm run whatsapp:simulate  # Simulador de mensajes WhatsApp entrantes
```

## Verificacion antes de commit

```bash
npx tsc --noEmit
npm run build
```

Ambos deben pasar limpios.

## Documentacion

- `project.md` — contexto de negocio y dolor que resuelve.
- `architecture.md` — referencia tecnica: stack, estructura, convenciones, modelo de datos.
- `SUPABASE_SETUP.md` — guia de configuracion de Supabase.
- `supabase/migrations/` — schema de base de datos y politicas RLS (fuente de verdad del modelo).

## Estado del proyecto

Desarrollo activo. La funcionalidad core (clientes, viajes, itinerarios, vista publica, portal del cliente, proveedores, agentes) esta operativa. El agente WhatsApp y el WCC estan en desarrollo iterativo.

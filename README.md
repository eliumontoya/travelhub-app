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


<a href="https://github.com/Gentleman-Programming/gentle-ai">
  <img width="220" src="https://raw.githubusercontent.com/Gentleman-Programming/gentle-ai/main/docs/assets/brand/built-with-gentle-ai.png" alt="Built with Gentle-AI" />
</a>

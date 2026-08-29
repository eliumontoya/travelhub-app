# WhatsApp Command Control

WhatsApp Command Control (WCC) es el módulo interno para revisar la operación del agente inbound de WhatsApp sin cambiar el comportamiento del bot desde la interfaz.

## Qué incluye el MVP

- Dashboard `/dashboard/wcc` con señales de salud: escalaciones abiertas, conversaciones, contactos, mensajes pendientes/fallidos y knowledge por estado.
- Contactos WhatsApp con ficha de solo lectura y vínculos a cliente TravelHub cuando existen.
- Escalaciones de atención humana con filtros por estado/prioridad y links al contacto o conversación relacionada.
- Conversaciones agrupadas por hilo con timeline de mensajes e intents.
- Knowledge base con creación, edición y cambios de estado entre `draft`, `approved` y `archived`.

## Reglas operativas

- Contactos, conversaciones, mensajes, intents y escalaciones son vistas de solo lectura en WCC v1.
- La única mutación WhatsApp permitida desde WCC v1 es administrar `whatsapp_knowledge_entries`.
- Solo las entradas `approved` alimentan al agente inbound; `draft` y `archived` no se usan para respuestas automáticas.
- Si Supabase no está configurado o una tabla no está disponible, las páginas deben mostrar estados seguros en vez de romper la navegación.

## QA básico

Antes de promover cambios WCC, ejecutar:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
BASE_URL=http://localhost:3100 CI=true npm run test:e2e
```

# Guía operativa: Observabilidad WhatsApp/IA

Qué se guarda, dónde consultarlo y cómo diagnosticar fallas en TravelHub

Actualizado: 2026-09-01

## Resumen ejecutivo

La observabilidad WhatsApp/IA registra eventos operativos sanitizados para seguir un mensaje desde el webhook hasta la decisión del agente, tools, envíos, status callbacks y escalaciones. No persiste datos en base de datos en esta versión: usa logs estructurados del servidor y una ventana reciente en memoria para WCC.

## Qué se guarda

- `eventId`: identificador único de cada evento observado.
- `correlationId`: identificador estable para seguir el flujo completo.
- `type`: tipo de evento, por ejemplo `webhook.accepted`, `ai.decision`, `tool.finished`, `send.finished`.
- `outcome`: `success`, `failure` o `skipped`.
- `occurredAt`: fecha/hora del evento.
- `durationMs`: duración cuando aplica.
- `identifiers` y `diagnostics`: solo metadatos sanitizados.
- Métricas agregadas: webhooks, duplicados, auto-respuestas, needs-human, escalaciones, status callbacks, fallos de envío, fallos IA/tools.

## Qué NO se guarda

No se deben guardar teléfonos completos, tokens, secrets, prompts completos, completions del LLM, payload raw de WhatsApp, URLs privadas, SQL ni stack traces.

## Dónde se guarda

1. Logs estructurados del servidor con la etiqueta `whatsapp_ai_observability`.
   - Local: consola de `npm run dev`.
   - Producción: Vercel Logs.
2. Memoria temporal del proceso para el snapshot que lee WCC.
   - No es persistente.
   - Puede perderse si Vercel reinicia o cambia de instancia.
3. No hay tabla nueva de Postgres ni bucket nuevo de Storage.

## Dónde verlo

- En la app: `/dashboard/wcc`, sección “Observabilidad WhatsApp/IA”.
- En producción: Vercel Logs, buscando `whatsapp_ai_observability` o un `correlationId`.
- En código: `src/lib/observability/whatsapp-ai.ts`.

## Flujo de diagnóstico si algo falla

1. Confirma si WhatsApp pegó al webhook: busca `webhook.received` y `webhook.accepted`.
2. Si no aparece `webhook.accepted`, revisa `webhook.rejected` o `webhook.failed`.
3. Usa el `correlationId` para seguir el mismo flujo.
4. Revisa si hubo duplicado: `duplicate.skipped`.
5. Revisa persistencia: `persistence.finished`.
6. Revisa decisión IA: `ai.decision` con `auto_answer` o `needs_human`.
7. Si hubo tools, revisa `tool.finished`.
8. Si debía responder, revisa `send.finished`.
9. Si se escaló, revisa `escalation.created`.
10. Para mensajes salientes, revisa `status_callback.persisted`.

## Interpretación rápida de eventos

| Evento | Qué indica | Dónde buscar después |
|---|---|---|
| `webhook.rejected` | Firma inválida o secreto ausente | Variables `WHATSAPP_APP_SECRET` y firma Meta |
| `webhook.failed` | JSON inválido o error de procesamiento | Vercel Logs con el mismo `correlationId` |
| `duplicate.skipped` | WhatsApp reenvió un evento ya procesado | Normal si no hay efectos duplicados |
| `ai.decision` | Resultado del agente | Ver `decision`, `intent` y `confidence` sanitizados |
| `tool.finished` | Tool interna ejecutada o bloqueada | Ver `tool`, `status`, `reason` sanitizado |
| `send.finished` | Envío a WhatsApp terminó | Ver `status`, `skipped` y categoría de error |
| `escalation.created` | Se creó escalación a humano | Revisar WCC escalations |

## Limitaciones actuales

- No hay histórico persistente.
- No hay alertas ni integración con proveedor externo de monitoreo.
- WCC muestra una ventana reciente del proceso actual, no una fuente global histórica.
- Para análisis de largo plazo habría que agregar tabla dedicada o proveedor de observabilidad.

## Regla para futuras features WhatsApp/IA

Toda feature nueva debe reutilizar `src/lib/observability/whatsapp-ai.ts`, propagar el contexto existente y agregar tests si introduce nuevos tipos de evento o diagnósticos. No usar `console.log` directo ni guardar payloads raw.

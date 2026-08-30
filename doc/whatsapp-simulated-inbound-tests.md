# Pruebas simuladas de mensajes inbound de WhatsApp

Esta nota explica cómo probar el flujo de WhatsApp de TravelHub sin depender todavía de que Meta entregue mensajes reales desde WhatsApp al webhook productivo.

## Objetivo

Simular mensajes que un cliente enviaría al WhatsApp empresarial y validar el flujo completo:

```txt
Payload simulado -> Webhook Vercel -> Normalización -> Supabase -> Decisión -> Escalamiento/respuesta -> Evento CRM
```

## Script disponible

El script vive en:

```txt
scripts/whatsapp-simulate-inbound.mjs
```

Y se ejecuta con:

```bash
npm run whatsapp:simulate -- --text "Mensaje de prueba"
```

Por default envía el payload a:

```txt
https://app.xtravelhub.com/api/whatsapp/webhook
```

## Requisitos

1. Tener variables de WhatsApp configuradas en Vercel Production:

```txt
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_HUMAN_ALERT_PHONE
WHATSAPP_GRAPH_VERSION
WHATSAPP_VERIFY_TOKEN
WHATSAPP_APP_SECRET
```

2. Tener Supabase configurado en producción:

```txt
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

3. Para ejecutar localmente, el script puede leer `.env.local` y usar:

```txt
WHATSAPP_HUMAN_ALERT_PHONE
```

como teléfono simulado de remitente, salvo que se pase `--from` explícitamente.

## Resolución CRM de cliente por WhatsApp

Antes de probar preguntas dinámicas sobre viajes (por ejemplo, “¿cómo va mi viaje?”), verifica que el cliente tenga `clients.whatsapp` con el número de WhatsApp del remitente. El webhook entrega `event.fromPhone` en formato E.164 sin `+`; la búsqueda compara solo dígitos, así que formatos como `+52 ...` y `52...` son compatibles.

La migración `*_clients_whatsapp_lookup.sql` rellena `clients.whatsapp` desde `phone` cuando está vacío y crea un trigger para inserts/updates futuros. `whatsapp_contacts.linked_client_id` sigue funcionando como vínculo manual de compatibilidad si no hay match por `clients.whatsapp`.

No pegues teléfonos completos en issues, PRs ni logs compartidos; usa prefijos/sufijos enmascarados como `521…4567`.

## Variables para habilitar LLM

Para que el agente deje de usar solo el fallback conservador y pueda auto-responder desde `whatsapp_knowledge_entries`, configurar estas variables en Vercel Production:

```txt
WHATSAPP_AGENT_LLM_API_KEY=<api key del proveedor LLM>
WHATSAPP_AGENT_LLM_MODEL=<modelo a usar>
WHATSAPP_AGENT_LLM_BASE_URL=<endpoint OpenAI-compatible, opcional>
WHATSAPP_AGENT_LLM_TIMEOUT_MS=12000
```

Notas:

- Si `WHATSAPP_AGENT_LLM_API_KEY` o `WHATSAPP_AGENT_LLM_MODEL` faltan, el sistema mantiene el comportamiento seguro actual y escala a humano.
- `WHATSAPP_AGENT_LLM_BASE_URL` usa `https://api.openai.com/v1` por default.
- Para proveedores OpenAI-compatible, configurar el `BASE_URL` correspondiente.
- Para OpenCode Zen con modelos GPT/Grok/Muse que usan Responses API, usar:

```txt
WHATSAPP_AGENT_LLM_BASE_URL=https://opencode.ai/zen/v1/responses
WHATSAPP_AGENT_LLM_API_STYLE=responses
WHATSAPP_AGENT_LLM_MODEL=gpt-5.4-mini
```

- Para OpenCode Zen con modelos que usan Chat Completions, usar:

```txt
WHATSAPP_AGENT_LLM_BASE_URL=https://opencode.ai/zen/v1/chat/completions
WHATSAPP_AGENT_LLM_API_STYLE=chat_completions
```

- El LLM recibe solo conocimiento aprobado y debe devolver JSON estructurado; si no cita knowledge IDs aprobados, el sistema escala.


## Firma requerida del webhook

El webhook productivo valida la firma Meta `X-Hub-Signature-256` antes de parsear JSON o ejecutar cualquier side effect. Para pruebas reales contra `/api/whatsapp/webhook`, configura `WHATSAPP_APP_SECRET` en Vercel Production con el App Secret de Meta.

Si el secret falta, el `POST` falla cerrado con error de configuración. Si la firma falta, está mal formada o no coincide byte por byte con el cuerpo enviado, el webhook responde `401` y no registra contactos, conversaciones, mensajes ni callbacks.

El script firma automáticamente el body exacto enviado cuando `WHATSAPP_APP_SECRET` está disponible en `.env.local` o en el entorno. El modo `--dry-run` sigue siendo útil para revisar payload y headers sin enviar nada; si el secret está configurado, mostrará el header firmado sin imprimir el secret. Para validar tráfico productivo completo, usa el mismo App Secret configurado en el destino.

## Uso básico

```bash
npm run whatsapp:simulate -- --text "¿Cuál es su horario?"
```

```bash
npm run whatsapp:simulate -- --text "¿Qué servicios ofrecen?"
```

```bash
npm run whatsapp:simulate -- --text "Quiero cotizar un viaje a Cancún para diciembre"
```

```bash
npm run whatsapp:simulate -- --text "Necesito hablar con una persona"
```

## Opciones útiles

### Cambiar nombre del contacto simulado

```bash
npm run whatsapp:simulate -- --text "¿Qué servicios ofrecen?" --name "Cliente Prueba"
```

### Cambiar teléfono remitente simulado

Usar formato E.164 sin `+`:

```bash
npm run whatsapp:simulate -- --text "Hola" --from 521XXXXXXXXXX
```

### Probar idempotencia / duplicados

Ejecuta dos veces con el mismo `--message-id`:

```bash
npm run whatsapp:simulate -- --text "Mensaje duplicado" --message-id wamid.TEST_DUPLICADO_1
npm run whatsapp:simulate -- --text "Mensaje duplicado" --message-id wamid.TEST_DUPLICADO_1
```

Resultado esperado en la segunda ejecución:

```json
{
  "processed": 0,
  "duplicates": 1,
  "sendFailures": 0
}
```

### Ver payload sin enviarlo

```bash
npm run whatsapp:simulate -- --text "Prueba dry run" --dry-run
```

### Enviar a otro webhook

Por ejemplo, para probar preview/local expuesto:

```bash
npm run whatsapp:simulate -- --url "https://mi-url/api/whatsapp/webhook" --text "Hola"
```

## Validación esperada

Una ejecución exitosa debe responder algo similar a:

```json
{
  "received": 1,
  "processed": 1,
  "duplicates": 0,
  "sendFailures": 0
}
```

En Supabase deben aparecer registros en:

```txt
whatsapp_contacts
whatsapp_conversations
whatsapp_messages
whatsapp_intents
whatsapp_escalations
crm_sync_events
```

Para el estado actual del agente, lo normal es que los mensajes se escalen si no hay conocimiento aprobado suficiente o un proveedor LLM productivo conectado.

## Consultas rápidas en Supabase

```sql
select id, phone_e164, display_name, created_at
from whatsapp_contacts
order by created_at desc
limit 10;
```

```sql
select id, whatsapp_message_id, direction, body, status, created_at
from whatsapp_messages
order by created_at desc
limit 20;
```

```sql
select id, intent_type, confidence, summary, status, created_at
from whatsapp_intents
order by created_at desc
limit 20;
```

```sql
select id, reason, priority, status, summary, created_at
from whatsapp_escalations
order by created_at desc
limit 20;
```

```sql
select id, event_type, event_key, status, created_at
from crm_sync_events
order by created_at desc
limit 20;
```

## Nota sobre `phone_number_id`

El script omite `metadata.phone_number_id` por default.

Esto es intencional: así la app usa el `WHATSAPP_PHONE_NUMBER_ID` real configurado en Vercel al enviar respuestas outbound.

Si se incluye un `phone_number_id` falso, WhatsApp puede responder con error similar a:

```txt
Object with ID '<id>' does not exist or cannot be loaded due to missing permissions
```

## Limitaciones

Estas pruebas validan el flujo técnico de la app, pero no prueban que Meta entregue mensajes reales desde WhatsApp al webhook.

Para validar mensajes reales entrantes desde WhatsApp personal se requiere completar la configuración productiva de Meta si la plataforma lo exige:

- registro productivo del número,
- método de pago,
- verificación del negocio,
- app en Live Mode,
- webhook `messages` suscrito.

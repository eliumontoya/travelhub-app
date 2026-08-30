# Setup — Primera conversación real de WhatsApp inbound

## Objetivo

Configurar Meta WhatsApp Cloud API, Vercel y Supabase para probar una primera conversación real contra el flujo inbound de TravelHub.

Esta prueba busca validar que el sistema ya puede:

- recibir un mensaje de WhatsApp en el webhook,
- normalizar el payload,
- crear o actualizar contacto/conversación,
- registrar mensaje inbound,
- ejecutar el orquestador inbound,
- registrar intención,
- responder o escalar,
- guardar mensajes outbound,
- crear escalación si aplica,
- crear eventos staging para sincronización futura con CRM.

## Estado actual del producto

Ya existen los componentes principales del flujo inbound:

- `src/app/api/whatsapp/webhook/route.ts`
- `src/lib/whatsapp/normalize.ts`
- `src/lib/whatsapp/store.ts`
- `src/lib/whatsapp/inbound-service.ts`
- `src/lib/whatsapp/client.ts`
- `src/lib/whatsapp/escalation.ts`
- `src/lib/ai/whatsapp-inbound-agent.ts`

También existen las tablas Supabase creadas por la fase #199:

- `whatsapp_contacts`
- `whatsapp_conversations`
- `whatsapp_messages`
- `whatsapp_intents`
- `whatsapp_escalations`
- `whatsapp_knowledge_entries`
- `crm_sync_events`

## Nota importante sobre el agente LLM

El módulo `src/lib/ai/whatsapp-inbound-agent.ts` ya existe, pero actualmente el flujo no tiene todavía un proveedor OpenAI/LLM real conectado por configuración de producción.

Por eso, en la primera prueba real se espera validar principalmente:

- recepción del webhook,
- persistencia en Supabase,
- creación de conversación,
- escalación segura,
- envío de mensaje de seguimiento,
- alerta al humano si está configurada.

La auto-respuesta inteligente basada en conocimiento aprobado requiere una fase posterior para conectar el provider LLM real.

## Componentes y responsabilidades

### Webhook

**Archivo:** `src/app/api/whatsapp/webhook/route.ts`

Responsabilidades:

- `GET`: verificar el webhook de Meta usando `WHATSAPP_VERIFY_TOKEN`.
- `POST`: recibir payloads entrantes de Meta.
- Parsear JSON.
- Delegar procesamiento a `processWhatsAppWebhookPayload`.

Reglas:

- Debe estar disponible públicamente para Meta.
- No debe requerir sesión de usuario.
- No debe exponer secretos.

---

### Normalizador

**Archivo:** `src/lib/whatsapp/normalize.ts`

Responsabilidades:

- Convertir payload Meta en eventos internos normalizados.
- Extraer teléfono, nombre, message id, tipo, texto, timestamp y payload raw.

Reglas:

- Los mensajes no soportados no deben romper el flujo.
- Todo payload debe conservarse para auditoría/debug.

---

### Store / persistencia

**Archivo:** `src/lib/whatsapp/store.ts`

Responsabilidades:

- Crear/buscar contacto.
- Crear/buscar conversación abierta.
- Guardar mensajes inbound/outbound.
- Guardar intención.
- Crear escalaciones.
- Crear eventos en `crm_sync_events`.
- Marcar mensajes como procesados/respondidos/escalados.

Reglas:

- Usa Supabase con `SUPABASE_SERVICE_ROLE_KEY` server-side.
- Mantiene idempotencia por `whatsapp_message_id`.
- No debe depender del CRM externo.

---

### Orquestador inbound

**Archivo:** `src/lib/whatsapp/inbound-service.ts`

Responsabilidades:

- Coordinar el flujo completo después del webhook.
- Persistir inbound.
- Cargar contexto/conocimiento.
- Invocar al agente inbound.
- Guardar intención.
- Enviar respuesta automática o ejecutar escalación.
- Crear eventos staging para CRM.

Reglas:

- Es quien ejecuta side effects.
- El LLM no escribe directo en BD.
- El LLM no manda WhatsApps directamente.
- Debe evitar duplicar procesamiento cuando Meta reintenta un mensaje.

---

### Cliente WhatsApp Cloud API

**Archivo:** `src/lib/whatsapp/client.ts`

Responsabilidades:

- Enviar mensajes de texto mediante Meta WhatsApp Cloud API.
- Centralizar el uso de `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` y `WHATSAPP_GRAPH_VERSION`.

Reglas:

- No usa LLM.
- No decide intención.
- No decide escalación.
- Solo transporta mensajes hacia Meta.

---

### Escalación humana

**Archivo:** `src/lib/whatsapp/escalation.ts`

Responsabilidades:

- Construir texto de seguimiento para el cliente.
- Construir alerta para el humano.
- Preparar la información de escalación.

Reglas:

- Si el agente no puede responder, se debe escalar.
- La escalación debe quedar registrada aunque falle el envío de alerta.

---

### Agente inbound

**Archivo:** `src/lib/ai/whatsapp-inbound-agent.ts`

Responsabilidades:

- Clasificar intención.
- Generar resumen.
- Decidir `auto_answer` o `needs_human`.
- Devolver salida estructurada.

Reglas:

- No debe inventar información.
- Si no hay conocimiento aprobado suficiente, escala.
- Si no hay provider LLM configurado, escala de forma segura.
- No ejecuta side effects.

## Variables de entorno necesarias en Vercel

Configurar en Vercel → Project → Settings → Environment Variables → Production.

### Supabase

Estas ya deberían existir:

```txt
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### WhatsApp Cloud API

Agregar:

```txt
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_HUMAN_ALERT_PHONE=
WHATSAPP_GRAPH_VERSION=v20.0
```

Notas:

- `WHATSAPP_VERIFY_TOKEN`: lo inventamos nosotros. Debe coincidir exactamente con el token usado al configurar el webhook en Meta.
- `WHATSAPP_APP_SECRET`: App Secret de Meta. Es obligatorio para validar la firma `X-Hub-Signature-256` de cada `POST` antes de procesar mensajes o callbacks.
- `WHATSAPP_ACCESS_TOKEN`: token generado en Meta.
- `WHATSAPP_PHONE_NUMBER_ID`: id del número de WhatsApp en Meta.
- `WHATSAPP_HUMAN_ALERT_PHONE`: número personal/humano que recibirá alertas de escalación.
- `WHATSAPP_GRAPH_VERSION`: el código usa `v20.0` por default si no se define, pero conviene dejarlo explícito.

Importante:

- Todas estas variables son server-side.
- Ninguna debe llevar prefijo `NEXT_PUBLIC_`.
- Si `WHATSAPP_APP_SECRET` falta o está vacío, el webhook `POST` falla cerrado con error de configuración y no procesa payloads.
- El código actual usa `WHATSAPP_HUMAN_ALERT_PHONE`, no `WHATSAPP_HUMAN_ESCALATION_PHONE`.

## Paso 1 — Crear app en Meta Developers

1. Entrar a https://developers.facebook.com/
2. Crear una app nueva.
3. Elegir tipo de app compatible con negocio, normalmente **Business**.
4. Agregar el producto **WhatsApp**.
5. Entrar a **WhatsApp > API Setup**.

Meta mostrará datos como:

- Temporary access token.
- Test phone number.
- Phone number ID.
- WhatsApp Business Account ID.

Referencias oficiales:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform

## Paso 2 — Agregar número personal como destinatario de prueba

Si se usa el número de prueba de Meta:

1. En Meta Developers ir a **WhatsApp > API Setup**.
2. Buscar la sección de recipient/test phone number.
3. Agregar el WhatsApp personal que enviará/recibirá pruebas.
4. Confirmar el código que Meta envíe.

Sin este paso, Meta puede bloquear mensajes hacia/desde números no autorizados en ambiente de prueba.

## Paso 3 — Configurar variables en Vercel

En Vercel:

1. Abrir el proyecto TravelHub.
2. Ir a **Settings → Environment Variables**.
3. Agregar las variables WhatsApp en Production.
4. Confirmar que las variables Supabase ya existen.
5. Redeployar producción.

Ejemplo:

```txt
WHATSAPP_VERIFY_TOKEN=travelhub-whatsapp-webhook-token-super-secreto
WHATSAPP_ACCESS_TOKEN=EAAB...
WHATSAPP_PHONE_NUMBER_ID=1234567890
WHATSAPP_HUMAN_ALERT_PHONE=521XXXXXXXXXX
WHATSAPP_GRAPH_VERSION=v20.0
```

Formato del teléfono humano:

```txt
521XXXXXXXXXX
```

No usar `+` en la variable si Meta espera solo dígitos.

## Paso 4 — Configurar webhook en Meta

En Meta Developers:

1. Ir a **WhatsApp → Configuration**.
2. En webhook callback URL usar:

```txt
https://TU-DOMINIO.vercel.app/api/whatsapp/webhook
```

3. En verify token usar el mismo valor de:

```txt
WHATSAPP_VERIFY_TOKEN
```

4. Guardar/verificar.
5. Suscribir el webhook al campo:

```txt
messages
```

Referencias oficiales:

- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview

Importante:

- El endpoint debe ser público.
- Si Vercel Deployment Protection está activo, Meta no podrá verificar el webhook.
- Si el verify token no coincide, Meta devolverá error de validación.

## Paso 5 — Crear conocimiento inicial en Supabase

En Supabase SQL Editor, correr:

```sql
insert into whatsapp_knowledge_entries
  (topic, question, answer, tags, source, status, approved_at)
values
  (
    'horarios',
    '¿Cuál es el horario de atención?',
    'Nuestro horario de atención es de lunes a viernes de 9:00 a 18:00. Si escribes fuera de horario, una persona te contactará lo antes posible.',
    array['horarios', 'atencion'],
    'manual',
    'approved',
    now()
  );
```

Nota:

- Aunque el provider LLM real todavía no está conectado, este registro deja la base preparada.
- Para que el agente auto-responda usando este conocimiento, hace falta conectar el provider LLM real en una fase posterior.

## Paso 6 — Primera prueba real

Desde el WhatsApp personal autorizado como recipient de prueba, enviar mensaje al número business/test de Meta:

```txt
Hola, ¿cuál es su horario?
```

## Paso 7 — Validar en Supabase

Correr estas consultas:

```sql
select * from whatsapp_contacts order by created_at desc limit 5;
select * from whatsapp_conversations order by created_at desc limit 5;
select * from whatsapp_messages order by created_at desc limit 10;
select * from whatsapp_intents order by created_at desc limit 10;
select * from whatsapp_escalations order by created_at desc limit 10;
select * from crm_sync_events order by created_at desc limit 10;
```

## Resultado esperado

En la primera prueba deberíamos ver:

- Un contacto creado en `whatsapp_contacts`.
- Una conversación creada en `whatsapp_conversations`.
- Un mensaje inbound guardado en `whatsapp_messages`.
- Una intención registrada en `whatsapp_intents`.
- Probablemente una escalación en `whatsapp_escalations`.
- Un mensaje outbound al cliente indicando que una persona dará seguimiento.
- Una alerta al número `WHATSAPP_HUMAN_ALERT_PHONE`, si está configurado correctamente.
- Un evento en `crm_sync_events`.

## Troubleshooting

### Meta no valida el webhook

Revisar:

1. Callback URL correcto:

```txt
https://TU-DOMINIO.vercel.app/api/whatsapp/webhook
```

2. `WHATSAPP_VERIFY_TOKEN` idéntico en Vercel y Meta.
3. Producción redeployada después de configurar variables.
4. Endpoint público sin Vercel Deployment Protection.
5. Logs de Vercel para `GET /api/whatsapp/webhook`.

### Llega webhook pero no se guarda en Supabase

Revisar:

1. Logs de Vercel para `POST /api/whatsapp/webhook`.
2. `SUPABASE_SERVICE_ROLE_KEY` configurado en Vercel.
3. Que la migración `20260826194451_whatsapp_inbound_data_foundation.sql` esté aplicada.
4. Que las tablas `whatsapp_*` existan.

### No se manda respuesta por WhatsApp

Revisar:

1. `WHATSAPP_ACCESS_TOKEN` vigente.
2. `WHATSAPP_PHONE_NUMBER_ID` correcto.
3. Número destino autorizado como recipient de prueba.
4. Logs de Vercel para errores de Meta Graph API.
5. Tabla `whatsapp_messages` para mensajes outbound con status `failed`.

### No llega alerta al humano

Revisar:

1. `WHATSAPP_HUMAN_ALERT_PHONE` configurado.
2. Formato del teléfono en dígitos internacionales.
3. Que ese número esté autorizado como recipient de prueba si se usa sandbox/test number.
4. Resultado guardado en payload/status del mensaje outbound o logs de Vercel.

### El agente no responde con conocimiento aprobado

Estado esperado actualmente.

El módulo de decisión existe, pero si no hay provider LLM configurado, el agente escala por seguridad.

Para auto-respuestas reales falta una fase posterior:

- conectar proveedor OpenAI/LLM,
- agregar env var correspondiente,
- definir prompt final,
- validar respuesta con conocimiento citado.

## Checklist rápido

- [ ] App creada en Meta Developers.
- [ ] Producto WhatsApp agregado.
- [ ] Número personal agregado como recipient de prueba.
- [ ] `WHATSAPP_VERIFY_TOKEN` configurado en Vercel.
- [ ] `WHATSAPP_ACCESS_TOKEN` configurado en Vercel.
- [ ] `WHATSAPP_PHONE_NUMBER_ID` configurado en Vercel.
- [ ] `WHATSAPP_HUMAN_ALERT_PHONE` configurado en Vercel.
- [ ] Supabase env vars configuradas en Vercel.
- [ ] Producción redeployada.
- [ ] Webhook callback URL configurado en Meta.
- [ ] Webhook suscrito a `messages`.
- [ ] Conocimiento inicial insertado en Supabase.
- [ ] Mensaje de prueba enviado por WhatsApp.
- [ ] Registros validados en tablas `whatsapp_*`.
- [ ] Evento validado en `crm_sync_events`.

## Siguiente paso después de la prueba

Si la primera conversación real valida recepción, persistencia y escalación, el siguiente trabajo recomendado es conectar el provider LLM real para que el agente pueda auto-responder usando `whatsapp_knowledge_entries` aprobadas.

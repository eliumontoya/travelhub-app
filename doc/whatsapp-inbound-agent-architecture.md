# Arquitectura — Agente inbound de WhatsApp para TravelHub

## Intención y objetivo general

El objetivo es permitir que clientes contacten al negocio por WhatsApp y reciban una respuesta inmediata mediante un agente inbound conectado a TravelHub.

El agente debe funcionar como primer punto de contacto operativo. Su responsabilidad principal no es vender de forma autónoma ni reemplazar al agente humano, sino recibir, entender, responder cuando tenga conocimiento suficiente, registrar la intención del cliente y escalar cuando la conversación requiera intervención humana.

Al final de la implementación, esta arquitectura debe validarse contra la intención original:

> Un cliente puede escribir al WhatsApp empresarial, TravelHub recibe la interacción, el agente inbound responde si tiene conocimiento suficiente, registra la intención/interacción en Supabase y escala a humano cuando no pueda responder con seguridad. La información queda disponible para que un proceso externo sincronice el CRM interno.

## Alcance de esta arquitectura

### Incluido en v1

- Integración inbound con Meta WhatsApp Cloud API.
- Webhook para recibir mensajes de clientes.
- Agente inbound para responder preguntas generales usando conocimiento aprobado.
- Registro de contactos, conversaciones, mensajes, intenciones y escalaciones en Supabase.
- Base de conocimiento administrada en Supabase.
- Escalación humana mediante:
  - cola interna registrada en Supabase,
  - alerta al WhatsApp personal configurado del agente humano.
- Tabla/eventos staging para que un proceso externo lea la información y actualice el CRM interno.

### Fuera de alcance en v1

- Agente outbound proactivo.
- Dashboard visual tipo inbox dentro de TravelHub.
- Integración directa desde TravelHub hacia el CRM interno.
- Automatización sobre WhatsApp Web.
- Campañas, marketing masivo o gestión avanzada de templates.

## Arquitectura general

```txt
Cliente WhatsApp
  ↓
Meta WhatsApp Cloud API
  ↓
TravelHub /api/whatsapp/webhook
  ↓
Servicio orquestador inbound
  ├─ Normaliza payload de WhatsApp
  ├─ Persiste mensaje/contacto/conversación
  ├─ Consulta conocimiento aprobado en Supabase
  ├─ Invoca al agente inbound
  ├─ Envía respuesta automática si aplica
  └─ Ejecuta escalación si no puede resolver
  ↓
Supabase
  ├─ whatsapp_contacts
  ├─ whatsapp_conversations
  ├─ whatsapp_messages
  ├─ whatsapp_intents
  ├─ whatsapp_escalations
  ├─ whatsapp_knowledge_entries
  └─ crm_sync_events
  ↓
Proceso externo fuera de TravelHub
  └─ Lee Supabase y actualiza CRM interno
```

## Flujo inbound esperado

1. El cliente escribe al número de WhatsApp empresarial.
2. Meta WhatsApp Cloud API envía el evento al webhook de TravelHub.
3. TravelHub valida que el request venga de Meta.
4. El webhook entrega el payload al servicio orquestador inbound.
5. El orquestador normaliza el payload y guarda el mensaje raw en Supabase.
6. TravelHub responde rápido `200 OK` a Meta para evitar reintentos innecesarios.
7. El orquestador carga contacto, conversación, historial reciente y conocimiento aprobado.
8. El orquestador invoca al agente inbound.
9. El agente inbound clasifica la intención y devuelve una decisión estructurada.
10. El orquestador guarda la intención y ejecuta la acción decidida.
11. Si la decisión es `auto_answer`, el orquestador usa el cliente de WhatsApp para responder.
12. Si la decisión es `needs_human`, el orquestador ejecuta escalación, responde al cliente y alerta al humano.
13. Toda interacción relevante genera datos/eventos para que un proceso externo sincronice el CRM.

## Componentes a desarrollar

### 1. Webhook de WhatsApp

**Ubicación sugerida:**

`src/app/api/whatsapp/webhook/route.ts`

**Responsabilidad:**

- Exponer `GET` para verificación inicial del webhook de Meta.
- Exponer `POST` para recibir eventos entrantes de WhatsApp.
- Validar token/firma del request.
- Parsear payloads de Meta.
- Ignorar eventos que no sean mensajes entrantes relevantes.
- Persistir el mensaje raw para auditoría.
- Responder rápido a Meta con `200 OK`.
- Delegar el procesamiento de negocio al flujo inbound.

**Reglas generales:**

- No debe exponer secretos al cliente.
- Debe ser idempotente usando el message id de WhatsApp.
- No debe duplicar mensajes si Meta reintenta el webhook.
- No debe bloquear la respuesta HTTP esperando todo el razonamiento del agente.
- Debe guardar el payload original aunque el tipo de mensaje no sea soportado.

---


### 2. Servicio orquestador inbound

**Ubicación sugerida:**

`src/lib/whatsapp/inbound-service.ts`

**Responsabilidad:**

- Coordinar todo el flujo después de que el webhook recibe un mensaje.
- Ejecutar la normalización del payload.
- Guardar el mensaje entrante.
- Buscar o crear contacto y conversación.
- Cargar historial reciente y conocimiento aprobado.
- Invocar al agente inbound.
- Persistir la intención detectada.
- Decidir qué acción ejecutar según la salida del agente:
  - responder automáticamente,
  - escalar a humano,
  - registrar error o caso no soportado.
- Crear eventos staging para CRM externo.

**Reglas generales:**

- Es el único componente que debe coordinar múltiples piezas del flujo inbound.
- El webhook no debe implementar lógica de negocio directamente.
- El agente LLM no debe escribir directamente en Supabase ni enviar WhatsApps por sí mismo.
- `inbound-service.ts` ejecuta acciones con base en la decisión estructurada del agente.
- Debe mantener idempotencia para evitar duplicar respuestas o registros.
- Debe poder reintentar procesamiento sin reenviar respuestas duplicadas.

---

### 3. Normalizador de eventos WhatsApp

**Ubicación sugerida:**

`src/lib/whatsapp/normalize.ts`

**Responsabilidad:**

- Convertir payloads de Meta en estructuras internas simples.
- Extraer datos mínimos para el resto del sistema:
  - `messageId`
  - `fromPhone`
  - `profileName`
  - `messageText`
  - `timestamp`
  - `messageType`
  - `rawPayload`

**Reglas generales:**

- En v1 solo debe procesar texto como mensaje directamente respondible.
- Audio, imagen, documentos, ubicación u otros tipos deben registrarse y escalarse.
- No debe decidir respuesta ni intención.
- No debe descartar el payload original.

---

### 4. Cliente de WhatsApp Cloud API

**Ubicación sugerida:**

`src/lib/whatsapp/client.ts`

**Responsabilidad:**

- Centralizar llamadas server-side a Meta WhatsApp Cloud API.
- Enviar mensajes al cliente.
- Enviar alerta al WhatsApp humano configurado.
- Manejar errores de API.
- Devolver resultados estructurados de envío.

**Reglas generales:**

- Usar solo variables server-side.
- Nunca importarse desde componentes client-side.
- No decidir el contenido del mensaje; solo transportarlo.
- Registrar o devolver errores de forma trazable.
- Preparar soporte futuro para templates aprobados de WhatsApp.

---

### 5. Capa de persistencia WhatsApp

**Ubicación sugerida:**

`src/lib/whatsapp/store.ts`

**Responsabilidad:**

- Buscar o crear contacto por teléfono.
- Vincular contacto a `clients.id` cuando sea posible.
- Crear o actualizar conversación abierta.
- Guardar mensajes inbound y outbound.
- Guardar intención detectada.
- Crear escalaciones.
- Crear eventos staging para CRM externo.

**Reglas generales:**

- Usar Supabase service role únicamente del lado servidor.
- Mantener RLS habilitada en tablas nuevas.
- No acoplarse al CRM interno.
- Las escrituras deben ser idempotentes cuando dependan de IDs externos de WhatsApp.
- Debe permitir que procesos externos lean eventos pendientes de sincronización.

---

### 6. Base de conocimiento del agente

**Ubicación sugerida:**

Tabla Supabase:

`whatsapp_knowledge_entries`

**Responsabilidad:**

- Guardar el conocimiento aprobado que el agente puede usar para responder.
- Cubrir información como:
  - preguntas frecuentes,
  - servicios ofrecidos,
  - horarios,
  - formas de pago,
  - políticas,
  - límites de lo que el agente puede prometer.

**Reglas generales:**

- Solo entradas activas deben usarse para responder.
- Cada entrada debe tener título, categoría, contenido y estado.
- El agente no debe inventar información fuera de esta base.
- Si el conocimiento no alcanza para responder, debe escalar.
- La estructura debe permitir evolucionar después hacia búsqueda semántica o embeddings sin cambiar el objetivo del componente.

---

### 7. Agente inbound

**Ubicación sugerida:**

`src/lib/ai/whatsapp-inbound-agent.ts`

**Responsabilidad:**

- Recibir mensaje normalizado, contacto e historial reciente.
- Consultar conocimiento aprobado desde Supabase.
- Clasificar la intención del cliente.
- Decidir si responde automáticamente o escala.
- Generar respuesta breve, clara y segura.
- Devolver una salida estructurada para persistencia.

**Reglas generales:**

- No debe inventar información.
- No debe confirmar precios, disponibilidad o promesas comerciales si no están explícitamente en el conocimiento.
- Debe escalar si la confianza es baja.
- Debe escalar si la solicitud requiere criterio humano.
- Debe escalar si el mensaje no es texto soportado.
- Debe producir siempre una salida estructurada con:
  - intención detectada,
  - resumen,
  - confianza,
  - respuesta propuesta,
  - decisión: `auto_answer` o `needs_human`,
  - razón de la decisión.

---

### 8. Motor de escalación humana

**Ubicación sugerida:**

`src/lib/whatsapp/escalation.ts`

**Responsabilidad:**

- Crear una escalación interna en Supabase.
- Enviar una alerta al WhatsApp personal configurado del agente humano.
- Generar una respuesta segura para el cliente indicando que una persona dará seguimiento.

**Reglas generales:**

- Debe escalar cuando:
  - no hay conocimiento suficiente,
  - la confianza del agente es baja,
  - se requiere cotización específica,
  - hay que revisar documentos,
  - hay urgencia o queja,
  - el mensaje no es texto,
  - el cliente pide explícitamente hablar con una persona.
- La alerta al humano debe incluir:
  - nombre detectado,
  - teléfono,
  - resumen,
  - intención,
  - último mensaje,
  - prioridad.
- La escalación debe quedar registrada aunque falle el envío de alerta al humano.

---

### 9. Eventos staging para CRM externo

**Ubicación sugerida:**

Tabla Supabase:

`crm_sync_events`

**Responsabilidad:**

- Servir como cola/staging table para que un proceso externo lea interacciones relevantes y actualice el CRM interno.

**Reglas generales:**

- TravelHub no debe llamar directamente al CRM.
- Cada interacción relevante debe crear un evento.
- Los eventos deben tener estado:
  - `pending`
  - `processing`
  - `processed`
  - `failed`
- El proceso externo será responsable de marcar eventos como procesados o fallidos.
- Los eventos deben incluir suficiente contexto para que el CRM pueda actualizar seguimiento sin reinterpretar todo el historial.

---

### 10. Endpoint de recuperación/reintentos

**Ubicación sugerida:**

`src/app/api/cron/whatsapp-inbound-retries/route.ts`

**Responsabilidad:**

- Revisar mensajes o jobs inbound que hayan quedado pendientes o fallidos.
- Reintentar procesamiento o marcar error permanente.

**Reglas generales:**

- Debe protegerse con `CRON_SECRET`, siguiendo el patrón existente de cron en TravelHub.
- No debe reenviar respuestas duplicadas al cliente.
- Debe respetar idempotencia por message id y estado de conversación.

## Tablas Supabase sugeridas

### `whatsapp_contacts`

Representa a una persona/contacto que escribe por WhatsApp.

Campos conceptuales:

- `id`
- `phone`
- `profile_name`
- `client_id` opcional hacia `clients.id`
- `created_at`
- `updated_at`

Reglas:

- `phone` debe ser único o tener índice único normalizado.
- Puede existir sin estar vinculado a un cliente TravelHub.
- La vinculación con `clients` puede hacerse después.

---

### `whatsapp_conversations`

Representa una conversación activa o histórica con un contacto.

Campos conceptuales:

- `id`
- `contact_id`
- `status`
- `last_message_at`
- `needs_human`
- `created_at`
- `updated_at`

Reglas:

- Una conversación puede estar `open`, `escalated`, `closed` o `archived`.
- El agente inbound trabaja sobre la conversación abierta más reciente.
- Si una conversación está escalada, el agente debe evitar seguir respondiendo como si nada.

---

### `whatsapp_messages`

Registra mensajes inbound y outbound.

Campos conceptuales:

- `id`
- `conversation_id`
- `whatsapp_message_id`
- `direction`
- `message_type`
- `body`
- `raw_payload`
- `send_status`
- `created_at`

Reglas:

- `whatsapp_message_id` debe permitir idempotencia.
- `raw_payload` debe ser `jsonb`.
- `direction` debe distinguir `inbound` y `outbound`.
- Mensajes no soportados también deben guardarse.

---

### `whatsapp_intents`

Registra la interpretación del agente sobre cada interacción relevante.

Campos conceptuales:

- `id`
- `conversation_id`
- `message_id`
- `intent`
- `summary`
- `extracted_data`
- `confidence`
- `decision`
- `created_at`

Reglas:

- `extracted_data` debe ser `jsonb`.
- `decision` debe distinguir `auto_answer` y `needs_human`.
- Debe haber suficiente información para que el proceso externo actualice CRM.

---

### `whatsapp_escalations`

Registra casos que requieren intervención humana.

Campos conceptuales:

- `id`
- `conversation_id`
- `message_id`
- `reason`
- `priority`
- `status`
- `human_alert_status`
- `created_at`
- `resolved_at`

Reglas:

- Crear escalación aunque falle la alerta por WhatsApp.
- `status` debe permitir al menos `pending`, `resolved`, `cancelled`.
- `priority` debe permitir al menos `normal`, `high`, `urgent`.

---

### `whatsapp_knowledge_entries`

Guarda conocimiento aprobado para el agente.

Campos conceptuales:

- `id`
- `title`
- `category`
- `content`
- `status`
- `priority`
- `created_at`
- `updated_at`

Reglas:

- Solo `status = active` se usa para responder.
- Debe poder desactivarse conocimiento sin borrarlo.
- En v1 puede usarse búsqueda simple; embeddings pueden agregarse después.

---

### `crm_sync_events`

Cola de eventos para sincronización externa con CRM.

Campos conceptuales:

- `id`
- `event_type`
- `entity_type`
- `entity_id`
- `payload`
- `status`
- `attempts`
- `last_error`
- `created_at`
- `processed_at`

Reglas:

- `payload` debe ser `jsonb`.
- El proceso externo consume eventos `pending`.
- TravelHub solo crea eventos; el proceso externo marca procesamiento.

## Variables de entorno

Agregar a `.env.example` y configurar en Vercel:

```txt
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_HUMAN_ESCALATION_PHONE=
OPENAI_API_KEY=
```

Notas:

- Todas estas variables son server-side.
- Ninguna debe usar prefijo `NEXT_PUBLIC_`.
- `WHATSAPP_ACCESS_TOKEN` debe tratarse como secreto sensible.
- `SUPABASE_SERVICE_ROLE_KEY` ya existe en la arquitectura del proyecto y será necesaria para escrituras server-side.

## Reglas generales del sistema

- El agente inbound debe ser conservador: si duda, escala.
- Todo mensaje entrante debe quedar registrado antes de intentar responder.
- Todo mensaje saliente generado por el sistema debe quedar registrado.
- Todo caso escalado debe generar registro interno aunque falle la alerta al humano.
- TravelHub no debe depender del CRM para responder inbound.
- El CRM no debe ser fuente de verdad para el webhook inbound en v1.
- El conocimiento autorizado vive en Supabase.
- El proceso externo de CRM lee Supabase, no al revés.
- El agente outbound proactivo es un componente futuro separado.
- El webhook solo recibe/valida/delega; la lógica del flujo vive en `src/lib/whatsapp/inbound-service.ts`.
- `src/lib/whatsapp/client.ts` solo transporta mensajes hacia WhatsApp; no usa LLM ni decide intención.
- `src/lib/ai/whatsapp-inbound-agent.ts` usa el LLM para razonar, pero no ejecuta escrituras ni envíos directamente.


## Flujo completo recomendado

  1. Webhook recibe payload de Meta
  2. Webhook llama inbound-service
  3. inbound-service llama normalize.ts
  4. inbound-service usa store.ts para guardar mensaje inbound
  5. inbound-service carga contacto, conversación, historial y conocimiento
  6. inbound-service llama whatsapp-inbound-agent.ts
  7. inbound-agent devuelve decisión estructurada
  8. inbound-service guarda intención en Supabase
  9. Si decision = auto_answer:
       - inbound-service usa client.ts para responder por WhatsApp
       - store.ts guarda mensaje outbound
  10. Si decision = needs_human:
       - escalation.ts crea escalación
       - client.ts avisa al WhatsApp humano
       - client.ts responde al cliente que una persona dará seguimiento
       - store.ts registra todo
  11. store.ts crea evento para CRM externo


## Orden de creación recomendado

1. Crear migración Supabase con tablas WhatsApp y CRM staging.
2. Crear tipos TypeScript para contactos, conversaciones, mensajes, intenciones y escalaciones.
3. Crear normalizador de payloads WhatsApp.
4. Crear capa de persistencia en Supabase.
5. Crear cliente server-side de WhatsApp Cloud API.
6. Crear agente inbound.
7. Crear servicio orquestador `src/lib/whatsapp/inbound-service.ts`.
8. Crear webhook `GET` y `POST`.
9. Integrar webhook con `inbound-service.ts`.
10. Crear reglas de escalación humana.
11. Crear base de conocimiento mínima en Supabase.
12. Crear endpoint cron de recuperación/reintentos.
13. Crear tests unitarios e integración.
14. Configurar variables en Vercel.
15. Configurar webhook en Meta Developer App.
16. Probar con número real.
17. Documentar operación y troubleshooting.

## Criterios de éxito

La implementación estará alineada con la intención original si:

- Un cliente puede escribir al WhatsApp empresarial.
- TravelHub recibe el mensaje por webhook.
- El mensaje queda registrado en Supabase.
- El agente responde automáticamente si la duda está cubierta por conocimiento aprobado.
- El agente escala si no puede responder con seguridad.
- La escalación queda registrada en Supabase.
- El humano recibe alerta cuando hay escalación.
- La intención/interacción queda disponible para sincronización externa al CRM.
- El sistema no implementa todavía agente outbound proactivo dentro del alcance inbound v1.

## Decisiones ya tomadas

- Proveedor WhatsApp v1: Meta WhatsApp Cloud API.
- Conocimiento del agente: tabla en Supabase.
- Escalación: cola interna en Supabase + alerta por WhatsApp personal.
- Sin dashboard visual en v1: solo BD/API.
- CRM: integración externa leyendo staging DB en Supabase.
- Alcance actual: solo agente inbound.
- Componente orquestador explícito: `src/lib/whatsapp/inbound-service.ts`.
- `client.ts` significa cliente de la API de WhatsApp, no cliente final ni agente LLM.

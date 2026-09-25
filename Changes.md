# Changes

Este archivo alimenta el modal "Qué hay de nuevo" del dashboard. Para agregar novedades, añade una entrada nueva arriba usando este formato:

```md
## YYYY-MM-DD — Título corto
Descripción breve enfocada en lo que cambió para el usuario.
```

## 2026-09-25 — Rediseño del dashboard
El login, el workspace de viajes y el editor de itinerarios recibieron un rediseño completo con un nuevo sistema de diseño compartido para el operador.

## 2026-09-25 — Control de features por agente
El administrador puede activar o desactivar features individuales para cada cuenta de agente desde /dashboard/settings/accounts, permitiendo planes y permisos granulares.

## 2026-09-21 — Herramientas MCP para agentes IA
TravelHub expone un servidor MCP con 41+ herramientas para que agentes de IA externos gestionen clientes, viajes, items, documentos, servicios, proveedores y actividades del viajero.

## 2026-09-20 — Checklist de documentos de servicio
El agente puede solicitar documentos al cliente con un checklist por viaje. El cliente sube los archivos desde su portal y el agente revisa, aprueba o solicita corrección.

## 2026-09-19 — Viajeros pueden crear actividades
Desde la vista pública del viaje, los viajeros pueden agregar sus propias actividades al itinerario sin necesidad de que el agente las cree.

## 2026-09-18 — Portal del cliente con login PIN
Los clientes pueden autenticarse con email y un PIN personal para ver sus viajes, subir documentos solicitados y consultar el progreso de servicios.

## 2026-09-18 — Import/export Excel para base de conocimiento
La base de conocimiento del agente WhatsApp puede importarse y exportarse en formato Excel para gestión masiva de preguntas y respuestas.

## 2026-09-16 — Catálogo de agentes de viaje
Nuevo catálogo de agentes con asignación de viajes por agente y filtro por agente en el dashboard.

## 2026-09-16 — Roles de cuenta y permisos
Sistema de roles (admin/agente) con permisos diferenciados y navegación condicionada al tipo de cuenta.

## 2026-09-16 — Logo de marca en login
El login del operador ahora muestra el logo de la marca para una experiencia más personalizada.

## 2026-09-13 — Agente WhatsApp sobre Eve framework
El agente de WhatsApp migró a Vercel Eve framework, con persistencia de escalamientos en base de datos y mejor aislamiento de clientes Supabase.

## 2026-08-31 — Observabilidad del agente WhatsApp
Telemetría estructurada y sanitizada para el agente WhatsApp/IA, con eventos typed, métricas operativas y runbook de diagnóstico.

## 2026-08-30 — Recordatorios por email protegidos
El endpoint de recordatorios automáticos ahora requiere CRON_SECRET en producción para evitar ejecuciones no autorizadas.

## 2026-08-29 — Verificación de webhooks de WhatsApp
Los webhooks entrantes de WhatsApp ahora verifican firma criptográfica para garantizar que provienen de Meta.

## 2026-08-29 — WhatsApp Control Center (WCC)
Panel completo en el dashboard para gestionar conversaciones, contactos, escalamientos, base de conocimiento y vinculación de contactos de WhatsApp con clientes del CRM.

## 2026-08-28 — WhatsApp respeta viajes no publicados
La automatización de WhatsApp ya no comparte detalles de un viaje hasta que esté publicado; si el viaje sigue en planeación, responde con un mensaje seguro.

## 2026-08-28 — WhatsApp del cliente en el CRM
La ficha de cliente y el alta de viaje ahora permiten guardar un número de WhatsApp específico, separado del teléfono, para identificar mejor los mensajes entrantes.

## 2026-08-27 — Asistente de WhatsApp con contexto del viaje
El agente de WhatsApp puede interpretar mensajes entrantes, consultar datos controlados del cliente/viaje y escalar al agente humano cuando la conversación lo requiere.

## 2026-08-26 — Recepción automática de mensajes de WhatsApp
Se agregó la base para recibir webhooks de WhatsApp, guardar conversaciones y preparar respuestas automáticas desde TravelHub.

## 2026-08-26 — Páginas de privacidad y eliminación de datos
TravelHub ya incluye páginas públicas de privacidad y eliminación de datos para soportar integraciones externas y requisitos de plataforma.

## 2026-08-26 — Eliminación de viajes y clientes
Ahora se pueden eliminar viajes y clientes desde el dashboard con controles de seguridad para evitar borrados accidentales.

## 2026-08-25 — Proveedores enriquecidos con Google Places
Los proveedores pueden buscarse y enriquecerse con datos de Google Places, incluyendo ubicación y marcadores visuales para distinguir coincidencias verificadas.

## 2026-08-25 — Documentos globales del viaje
Además de documentos por actividad, el viaje puede tener documentos generales visibles también en la experiencia pública del viajero.

## 2026-08-24 — Itinerario público rediseñado
La vista pública del viajero recibió un rediseño visual, con mejor presentación de días, notas, documentos, branding y selector de idioma.

## 2026-08-24 — Portada personalizada del viaje
Cada viaje puede mostrar una imagen de portada propia y branding de la agencia para dar una experiencia más personalizada al cliente.

## 2026-08-23 — Notas enriquecidas y checklist público
Las notas del viaje aceptan formato enriquecido seguro y la checklist de equipaje ya puede mostrarse en modo lectura en la vista pública.

## 2026-08-23 — Enviar itinerario por correo
Desde el editor del viaje se puede abrir un diálogo para enviar por email el itinerario completo en formato HTML.

## 2026-08-23 — Duplicar y mover actividades
El editor permite duplicar actividades y moverlas entre días, acelerando la construcción de itinerarios repetitivos o similares.

## 2026-07-15 — Tags recientes en el combobox de etiquetas
El selector de etiquetas ahora muestra las tags usadas más recientemente al abrir el dropdown sin escribir nada, para reutilizarlas más rápido.

## 2026-07-08 — Creación de clientes en línea
Se puede crear un cliente nuevo directamente desde el buscador de clientes de un viaje, sin salir del flujo para ir a la sección de clientes.

## 2026-06-30 — Etiquetas para viajes
Cada viaje admite ahora cero o varias etiquetas (tags) para clasificarlo y encontrarlo más fácilmente en el listado.

## 2026-06-10 — Relación de clientes con viajes
Se agregó la relación muchos a muchos entre clientes y viajes, con ficha de cliente que incluye historial de viajes asociados.

## 2026-05-28 — Menú de perfil y configuración del sitio
Nuevo menú de perfil en el panel con acceso a la configuración de contacto del sitio.

# Automatizaciones

Tu tiempo vale. TravelHub automatiza lo repetitivo para que te enfoques en lo que importa: armar viajes increíbles.

---

## Recordatorios automáticos por email

Cuando publicás un viaje, TravelHub puede enviarle un recordatorio a tu cliente **N días antes de que arranque el viaje** (configurable, default 3 días).

### Cómo funciona

1. El recordatorio se envía automáticamente al email del cliente asignado
2. Incluye: título del viaje, fecha de inicio, link a la vista pública
3. El sistema lleva registro de qué viajes ya fueron notificados — no spamea
4. Se dispara mediante un cron job externo (Vercel Cron, cron-job.org, etc.) al endpoint `/api/cron/trip-reminders`

### Requisitos

- Una API key de [Resend](https://resend.com) para el envío de emails
- Opcional: `CRON_SECRET` para proteger el endpoint contra accesos no autorizados

---

## Plantillas de viaje

¿Tenés un viaje que se repite? Guardalo como plantilla y reutilizalo:

1. Desde el editor, hacé clic en "Guardar como plantilla"
2. El viaje se guarda con todos sus días e ítems (sin documentos)
3. Al crear un viaje nuevo, seleccionás la plantilla y los días/ítems se copian automáticamente

Ideal para:
- Destinos que trabajás seguido (ej. "Cancún 5 días", "NYC 7 días")
- Tipos de viaje estandarizados (luna de miel, corporativo, familiar)

---

## Duplicar viaje

Si necesitás una copia exacta de un viaje existente (para otro cliente, para otra fecha), usá el botón "Duplicar". Se copian días e ítems. Los documentos no se duplican — así evitás acumular archivos huérfanos.

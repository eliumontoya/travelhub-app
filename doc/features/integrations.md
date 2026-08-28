# Integraciones

TravelHub suma capacidades sin fricción. Cada integración es opt-in y **degrade con gracia**: si no configurás la API key, la funcionalidad simplemente no aparece. Sin errores, sin pantallas rotas.

---

## Mapas y ubicaciones

| Capacidad | Qué aporta | Requisito |
|---|---|---|
| **Mapa embebido** | Cada ítem con coordenadas muestra su ubicación en un mapa interactivo dentro del itinerario | Google Maps Embed API key |
| **Autocomplete de ubicaciones** | Mientras escribís una dirección, Google Places te sugiere resultados | Google Maps API key (misma) |
| **Link a Google Maps** | Si no hay API key, se muestra un link que abre la ubicación en Google Maps — siempre funciona | Ninguno |

---

## Estado de vuelos en vivo

Los ítems tipo vuelo muestran un badge con el estado real del vuelo: Programado, En vuelo, Aterrizó, Cancelado, Incidente o Desviado.

- Se consulta manualmente desde el badge para evitar gastar requests innecesarios
- Usa únicamente el campo estructurado **Número de vuelo** del ítem, no lo infiere desde el título
- Guarda el último resultado en `localStorage` con TTL configurable (`NEXT_PUBLIC_FLIGHT_STATUS_CACHE_HOURS`, default 24h)
- API: Aviationstack (se necesita `FLIGHT_API_KEY`)

---

## Clima del destino

Cada día del viaje muestra temperatura máxima/mínima e ícono del clima.

- Gratuito, sin API key
- Datos de Open-Meteo (modelo abierto, sin restricciones de uso)
- Caché de 30 minutos
- Soporta 30+ códigos de clima (despejado, lluvia, nieve, tormentas, etc.)

---

## Documentos y almacenamiento

Los documentos adjuntos (boarding passes, vouchers, confirmaciones, pasaportes) se almacenan en Supabase Storage:

- Bucket privado con URLs firmadas por tiempo limitado
- Estructura: `trips/{tripId}/{itemId}/` y `clients/{clientId}/`
- Fotos de viaje en bucket público

---

## Recordatorios por email

- Envío automático de recordatorios vía Resend API
- HTML template con datos del viaje y link directo
- Control de frecuencia: solo un recordatorio por viaje, nunca spam

---

## QR Code

Cada viaje publicado genera un código QR con su URL pública. Podés descargarlo como PNG para imprimirlo o incluirlo en materiales promocionales.

- No requiere API key (librería `qrcode` embebida)
- Se genera desde el editor con un clic

# Herramientas Extra

Funcionalidades que elevan la experiencia del agente y del viajero — sin ser el core del producto, marcan la diferencia.

---

## Galería de Fotos del Viaje

Subí fotos representativas del viaje (destino, hotel, paisajes) para que el cliente las vea tanto en el editor como en su portal público.

- Subida directa desde el editor (imágenes)
- Vista en grilla
- Borrado con confirmación
- Requiere Supabase Storage configurado
- Degrada con gracia: si no hay bucket, la galería no se muestra

---

## Packing List

Una checklist de equipaje por viaje. El agente la arma desde el editor, y puede:

- Agregar/quitar ítems
- Tachar lo que ya está empacado (strikethrough)
- Persistencia: al cerrar y volver, el estado se conserva

---

## Vista Cotización

Una vista limpia, lista para imprimir, con el desglose de costos del viaje:

- Título, cliente, fechas
- Cada día con sus ítems, ubicación y costo individual
- Subtotal por día y gran total
- Botón de impresión

Ideal para:
- Enviarle un presupuesto formal al cliente
- Imprimir y adjuntar a la factura

---

## Encuestas Post-Viaje

Una vez que el viaje terminó, el cliente puede calificar su experiencia directamente desde el portal público:

- Calificación de 1 a 5 estrellas
- Comentario opcional
- Confirmación visible ("¡Gracias!")
- Las calificaciones se ven desde el editor del viaje

Sin formularios externos, sin que el cliente tenga que ir a otra plataforma. Todo dentro de TravelHub.

---

## Atajos de Teclado (modo editor)

| Tecla | Acción |
|---|---|
| `n` | Agregar nuevo día |
| `i` | Agregar nuevo ítem al último día |
| `esc` | Cerrar diálogo abierto |

---

## Exportar Clientes a CSV

Desde el dashboard, exportá tu lista de clientes (con los filtros activos) a un archivo CSV compatible con Excel, Google Sheets y cualquier otra herramienta.

- Formato: RFC 4180
- Nombre: `clientes-YYYY-MM-DD.csv`
- Incluye los filtros que tengas aplicados en el explorador

---

## Compartir por WhatsApp y QR

Desde el editor, podés:

- **Copiar URL pública** al portapapeles
- **Compartir por WhatsApp** — abre WhatsApp con el link precargado
- **Generar QR** descargable como PNG para ponerlo en materiales impresos
- **Copiar resumen del viaje** como texto plano — ideal para mandar por mensaje

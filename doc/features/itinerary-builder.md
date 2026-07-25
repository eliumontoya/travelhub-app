# Constructor de Itinerarios

El corazón de TravelHub. Arma el viaje de tu cliente día por día con todo lo que necesita saber: vuelos, hoteles, actividades, restaurantes, transporte y notas.

---

## Cómo funciona

Cada viaje se organiza en **días**, y cada día contiene **ítems** del tipo que necesites. El orden se controla con botones arriba/abajo — simple, predecible, sin arrastres accidentales.

### Tipos de ítem

| Tipo | Qué registrás |
|---|---|
| ✈️ Vuelo | Aerolínea, número de vuelo, hora, estado en vivo, confirmación |
| 🏨 Hotel | Nombre, check-in/check-out, dirección, confirmación |
| 🎯 Actividad | Nombre, hora, ubicación, notas, costo |
| 🍽️ Restaurante | Nombre, hora, dirección, confirmación |
| 🚗 Transporte | Tipo (taxi, transfer, rental), hora, costo, confirmación |
| 📝 Nota | Texto libre — instrucciones, datos útiles, lo que haga falta |

### Lo que podés hacer en el editor

- Agregar/quitar días y generar automáticamente los que faltan entre la fecha de inicio y fin
- Editar cada ítem con formulario completo: tipo, título, hora, ubicación con coordenadas, costo, notas y documentos adjuntos
- Adjuntar documentos por ítem (boarding passes, vouchers, confirmaciones)
- Subir fotos del viaje (galería visible para el agente y el cliente)
- Llevar un **packing list** por viaje con checkboxes
- Ver barra de completitud: qué % de ítems tienen documentos adjuntos
- Activar/desactivar "Mostrar costos al cliente" — lo que ves cuando editas no es lo que ve el cliente si no querés
- Agregar **notas internas** que SOLO ve el agente, nunca el cliente
- Configurar presupuesto, comisión, moneda (MXN/USD/EUR)
- Guardar el viaje como **plantilla** para reusar en viajes futuros
- Duplicar el viaje completo (días + ítems, sin documentos)
- Previsualizar la vista pública antes de compartir

### Para el ojo del agente

- **Estado en vivo de vuelos** (vía Aviationstack) — sin abrir otra página
- **Clima del destino** por día (vía Open-Meteo) — gratuito, sin API key
- **Mapa embebido** (Google Maps) cuando el ítem tiene coordenadas
- Atajos de teclado: `n` para nuevo día, `i` para nuevo ítem, `esc` para cerrar

### Seguridad

Los documentos se almacenan en Supabase Storage con URLs firmadas. Las notas internas, precios de venta y comisiones NUNCA se exponen en la vista pública.

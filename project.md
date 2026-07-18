# Contexto de Negocio del Proyecto

Este documento es la referencia funcional principal de TravelHub. Resume el
propósito del negocio, el dolor operativo actual y los resultados esperados.

## Propósito

Darle a un agente de viajes independiente una herramienta propia para armar,
gestionar y compartir itinerarios de viaje con sus clientes, sin depender de
una plataforma de terceros (tipo Travefy) ni de sus costos, límites o
condiciones de servicio.

## Dolor del Negocio

- Depender de una herramienta externa de terceros para algo central del
  servicio que se le vende al cliente: el itinerario.
- Costo recurrente y falta de control sobre una plataforma que no es propia,
  con el riesgo de que suba de precio, cambie funciones o desaparezca.
- Procesos manuales o dispersos (documentos sueltos, mensajes de WhatsApp,
  PDFs) para comunicarle al cliente los detalles de su viaje: vuelos,
  hoteles, actividades, confirmaciones.
- Dificultad del cliente final para tener en un solo lugar su itinerario
  completo y poder agendarlo en su calendario personal.
- Nula trazabilidad del historial de viajes por cliente: no hay un lugar
  central para ver qué viajes ha tenido un cliente en el pasado.

## Solución Propuesta

Una aplicación propia, de uso interno para el agente de viajes, donde pueda:

- Dar de alta clientes y ver su historial de viajes.
- Crear un viaje y armar su itinerario día por día: vuelos, hoteles,
  actividades, restaurantes, transporte, notas — con horarios, ubicaciones,
  números de confirmación y documentos adjuntos (boarding passes, vouchers).
- Publicar el itinerario y compartir con el cliente una URL única y
  personal, sin que el cliente necesite cuenta ni contraseña.
- Que el cliente, desde esa URL, pueda ver su itinerario completo y agregarlo
  directamente a su calendario personal (por día o el viaje completo).

## Resultados Esperados

- Eliminar la dependencia de una plataforma de terceros para la gestión de
  itinerarios.
- Reducir el tiempo que toma armar y comunicar un itinerario a cada cliente.
- Mejorar la experiencia del cliente final al recibir su viaje organizado,
  accesible desde el celular y sincronizable con su calendario.
- Tener un historial centralizado de clientes y sus viajes, útil para dar
  seguimiento y detectar oportunidades de negocio recurrente.
- Contar con una base propia que pueda crecer hacia más módulos (cotizaciones,
  pagos, app móvil) conforme el negocio lo requiera, sin las limitaciones de
  una herramienta de terceros.

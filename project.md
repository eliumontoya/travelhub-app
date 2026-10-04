# Contexto de Negocio del Proyecto

Este documento es la referencia funcional principal de TravelHub. Resume el
propósito del negocio, el dolor operativo actual y los resultados esperados.
Los detalles técnicos de implementación se mantienen en `architecture.md`; acá
se describe únicamente qué es el producto y para qué sirve. Los principios de
producto, los usuarios y la accesibilidad se mantienen en `PRODUCT.md`.

## Propósito

Darle a agentes de viajes independientes una herramienta propia para armar,
gestionar y compartir los viajes de sus clientes —el itinerario y todo lo que
lo rodea: documentación, visas y proveedores— sin depender de una plataforma de
terceros (tipo Travefy) ni de sus costos, límites o condiciones de servicio.
La misma instalación puede alojar más de una cuenta de agente, cada una con su
propio espacio de trabajo y con los módulos que tenga habilitados.

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
- La documentación del viaje (pasaportes, comprobantes, requisitos de visa) se
  intercambia de forma suelta: ni el agente ni el cliente tienen un lugar claro
  donde ver qué falta y qué ya se entregó.
- El seguimiento de las solicitudes de visa queda en planillas o hilos de
  mensajes, sin un estado visible ni un historial de avance.
- La conversación con el cliente vive en WhatsApp, separada del resto de la
  operación: contactos, consultas y escalaciones no quedan vinculados a los
  viajes ni a los clientes.
- Cuando el negocio pasa de una persona a varias, no hay una forma ordenada de
  dar acceso por rol ni de habilitar a cada agente solo los módulos que usa.

## Solución Propuesta

Una aplicación propia para el agente de viajes que cubre la operación completa
alrededor de un viaje:

- Dar de alta clientes y ver su historial de viajes.
- Crear un viaje y armar su itinerario día por día: vuelos, hoteles,
  actividades, restaurantes, transporte, notas — con horarios, ubicaciones,
  números de confirmación y documentos adjuntos (boarding passes, vouchers).
- Administrar un catálogo de proveedores (hoteles, restaurantes, transportes,
  tour operadores y otros) con sus datos de contacto y ubicación, y vincularlos
  a los puntos del itinerario para tener a mano con quién se reservó cada cosa.
- Gestionar servicios por viaje y cliente, con una lista de documentación
  requerida y la carga de los archivos correspondientes.
- Llevar las solicitudes de visa de cada cliente con su estado y su avance, y
  la documentación asociada.
- Operar el canal de WhatsApp desde un panel propio: conversaciones, contactos,
  escalaciones y una base de conocimiento comercial, con el contacto vinculado
  al cliente y sus viajes.
- Habilitar varias cuentas de agente bajo la misma instalación, con un rol
  administrador que define qué módulos ve cada agente.

Y dos formas complementarias de acceso para el cliente final:

- **Enlace público, sin cuenta ni contraseña.** El agente publica el
  itinerario y comparte una URL única y personal. El cliente la abre y ve su
  itinerario completo, puede agregarlo a su calendario personal (por día o el
  viaje completo), consultar la lista de equipaje y dejar comentarios. No hace
  falta crear usuario ni recordar credenciales. El agente también puede
  compartir el historial de viajes publicados de un cliente.
- **Portal autenticado del cliente, con email y PIN.** Cuando el viaje lo
  requiere, el cliente entra con su email y un PIN y accede a sus propios
  viajes y solicitudes de visa, a las listas de documentación con su progreso,
  y a la carga de los documentos requeridos. Además, sobre un itinerario
  publicado, puede agregar, editar y eliminar sus propias actividades.

Ambos modelos conviven y no se excluyen: el enlace resuelve la consulta rápida
sin fricción, y el portal se habilita cuando se necesita que el cliente
participe activamente —subir documentación, seguir una visa o completar su
itinerario con actividades propias.

La plataforma también expone su funcionalidad a asistentes de inteligencia
artificial externos mediante una integración autorizada, de modo que un agente
pueda consultar y operar sobre su propia información conversando con la
herramienta de IA que prefiera.

## Resultados Esperados

- Eliminar la dependencia de una plataforma de terceros para la gestión de
  itinerarios.
- Reducir el tiempo que toma armar y comunicar un itinerario a cada cliente.
- Mejorar la experiencia del cliente final al recibir su viaje organizado,
  accesible desde el celular y sincronizable con su calendario.
- Tener un historial centralizado de clientes y sus viajes, útil para dar
  seguimiento y detectar oportunidades de negocio recurrente.
- Que el cliente resuelva solo la entrega de su documentación, y que el agente
  siga el avance del viaje y de cada solicitud de visa en un mismo lugar, sin
  planillas ni idas y vueltas por mensajes.
- Que la conversación de WhatsApp quede registrada y conectada con el cliente y
  sus viajes, en lugar de perderse en un chat aparte.
- Que el negocio pueda operar con varias cuentas de agente y habilitar a cada
  una solo los módulos que necesita, sin multiplicar instalaciones.
- Que un asistente de IA externo pueda operar de forma autorizada sobre la
  misma información, sin exportaciones manuales.
- Contar con una base propia que pueda seguir creciendo hacia más módulos
  conforme el negocio lo requiera, sin las limitaciones de una herramienta de
  terceros.

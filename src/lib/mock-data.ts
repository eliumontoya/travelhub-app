import {
  Client,
  Trip,
  TripDay,
  Item,
  Tag,
  TripPhoto,
  TripWithDetails,
  TripStatusHistoryEntry,
  SiteSettings,
  PackingItem,
  TripFeedback,
  Supplier,
} from "@/types";

export const mockClients: Client[] = [
  {
    id: "c1",
    name: "Ana y Roberto Pérez",
    slug: "ana-y-roberto-perez",
    email: "ana.perez@example.com",
    phone: "+52 55 1234 5678",
    notes: "Luna de miel, prefieren hoteles boutique.",
    birthDate: "1990-08-01",
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: "2026-06-01T10:00:00Z",
  },
  {
    id: "c2",
    name: "Familia Gómez",
    slug: "familia-gomez",
    email: "gomez.family@example.com",
    phone: "+52 33 9876 5432",
    notes: "4 personas, 2 niños, buscan actividades familiares.",
    createdAt: "2026-06-10T10:00:00Z",
    updatedAt: "2026-06-10T10:00:00Z",
  },
  {
    id: "c3",
    name: "Cliente Demo 03",
    slug: "cliente-demo-03",
    email: "cliente03@example.com",
    phone: "+52 55 0000 0003",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-11T10:00:00Z",
    updatedAt: "2026-06-11T10:00:00Z",
  },
  {
    id: "c4",
    name: "Cliente Demo 04",
    slug: "cliente-demo-04",
    email: "cliente04@example.com",
    phone: "+52 55 0000 0004",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-12T10:00:00Z",
    updatedAt: "2026-06-12T10:00:00Z",
  },
  {
    id: "c5",
    name: "Cliente Demo 05",
    slug: "cliente-demo-05",
    email: "cliente05@example.com",
    phone: "+52 55 0000 0005",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-13T10:00:00Z",
    updatedAt: "2026-06-13T10:00:00Z",
  },
  {
    id: "c6",
    name: "Cliente Demo 06",
    slug: "cliente-demo-06",
    email: "cliente06@example.com",
    phone: "+52 55 0000 0006",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-14T10:00:00Z",
    updatedAt: "2026-06-14T10:00:00Z",
  },
  {
    id: "c7",
    name: "Cliente Demo 07",
    slug: "cliente-demo-07",
    email: "cliente07@example.com",
    phone: "+52 55 0000 0007",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-15T10:00:00Z",
    updatedAt: "2026-06-15T10:00:00Z",
  },
  {
    id: "c8",
    name: "Cliente Demo 08",
    slug: "cliente-demo-08",
    email: "cliente08@example.com",
    phone: "+52 55 0000 0008",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-16T10:00:00Z",
    updatedAt: "2026-06-16T10:00:00Z",
  },
  {
    id: "c9",
    name: "Cliente Demo 09",
    slug: "cliente-demo-09",
    email: "cliente09@example.com",
    phone: "+52 55 0000 0009",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-17T10:00:00Z",
    updatedAt: "2026-06-17T10:00:00Z",
  },
  {
    id: "c10",
    name: "Cliente Demo 10",
    slug: "cliente-demo-10",
    email: "cliente10@example.com",
    phone: "+52 55 0000 0010",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-18T10:00:00Z",
    updatedAt: "2026-06-18T10:00:00Z",
  },
  {
    id: "c11",
    name: "Cliente Demo 11",
    slug: "cliente-demo-11",
    email: "cliente11@example.com",
    phone: "+52 55 0000 0011",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-19T10:00:00Z",
    updatedAt: "2026-06-19T10:00:00Z",
  },
  {
    id: "c12",
    name: "Cliente Demo 12",
    slug: "cliente-demo-12",
    email: "cliente12@example.com",
    phone: "+52 55 0000 0012",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-20T10:00:00Z",
    updatedAt: "2026-06-20T10:00:00Z",
  },
  {
    id: "c13",
    name: "Cliente Demo 13",
    slug: "cliente-demo-13",
    email: "cliente13@example.com",
    phone: "+52 55 0000 0013",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-21T10:00:00Z",
    updatedAt: "2026-06-21T10:00:00Z",
  },
  {
    id: "c14",
    name: "Cliente Demo 14",
    slug: "cliente-demo-14",
    email: "cliente14@example.com",
    phone: "+52 55 0000 0014",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-22T10:00:00Z",
    updatedAt: "2026-06-22T10:00:00Z",
  },
  {
    id: "c15",
    name: "Cliente Demo 15",
    slug: "cliente-demo-15",
    email: "cliente15@example.com",
    phone: "+52 55 0000 0015",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-23T10:00:00Z",
    updatedAt: "2026-06-23T10:00:00Z",
  },
  {
    id: "c16",
    name: "Cliente Demo 16",
    slug: "cliente-demo-16",
    email: "cliente16@example.com",
    phone: "+52 55 0000 0016",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-24T10:00:00Z",
    updatedAt: "2026-06-24T10:00:00Z",
  },
  {
    id: "c17",
    name: "Cliente Demo 17",
    slug: "cliente-demo-17",
    email: "cliente17@example.com",
    phone: "+52 55 0000 0017",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-25T10:00:00Z",
    updatedAt: "2026-06-25T10:00:00Z",
  },
  {
    id: "c18",
    name: "Cliente Demo 18",
    slug: "cliente-demo-18",
    email: "cliente18@example.com",
    phone: "+52 55 0000 0018",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-26T10:00:00Z",
    updatedAt: "2026-06-26T10:00:00Z",
  },
  {
    id: "c19",
    name: "Cliente Demo 19",
    slug: "cliente-demo-19",
    email: "cliente19@example.com",
    phone: "+52 55 0000 0019",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-27T10:00:00Z",
    updatedAt: "2026-06-27T10:00:00Z",
  },
  {
    id: "c20",
    name: "Cliente Demo 20",
    slug: "cliente-demo-20",
    email: "cliente20@example.com",
    phone: "+52 55 0000 0020",
    notes: "Cliente demo para paginación.",
    createdAt: "2026-06-28T10:00:00Z",
    updatedAt: "2026-06-28T10:00:00Z",
  },
  {
    id: "c21",
    name: "Cliente Demo 21",
    slug: "cliente-demo-21",
    email: "cliente21@example.com",
    phone: "+52 55 0000 0021",
    notes: "Cliente demo para segunda página.",
    createdAt: "2026-06-29T10:00:00Z",
    updatedAt: "2026-06-29T10:00:00Z",
  },
];

export const mockTrips: Trip[] = [
  {
    id: "t1",
    clientId: "c1",
    title: "Luna de miel en Italia",
    slug: "italia-perez-2026",
    startDate: "2026-09-10",
    endDate: "2026-09-17",
    coverImageUrl:
      "https://images.unsplash.com/photo-1499678329028-101435549a4e?w=1200",
    instructions:
      "¡Bienvenidos! Llegada al hotel a partir de las 15:00. Contacto de emergencia 24/7: +39 06 1234 5678. Lleven documento de identidad para el check-in.",
    travelerCount: 2,
    status: "published",
    currency: "EUR",
    isTemplate: false,
    showCostsToClient: true,
    createdAt: "2026-07-01T09:00:00Z",
    updatedAt: "2026-07-01T09:00:00Z",
  },
  {
    id: "t2",
    clientId: "c2",
    title: "Aventura en Cancún",
    slug: "cancun-gomez-2026",
    startDate: "2026-12-15",
    endDate: "2026-12-20",
    travelerCount: 4,
    status: "draft",
    currency: "MXN",
    isTemplate: false,
    showCostsToClient: false,
    createdAt: "2026-07-05T09:00:00Z",
    updatedAt: "2026-07-05T09:00:00Z",
  },
];

export const mockTripDays: TripDay[] = [
  { id: "d1", tripId: "t1", date: "2026-09-10", sortOrder: 0 },
  { id: "d2", tripId: "t1", date: "2026-09-11", sortOrder: 1 },
];

// Catálogo mock de proveedores (issue #114), espejo de la tabla suppliers
// (ver supabase/migrations/0028_suppliers.sql).
export const mockSuppliers: Supplier[] = [
  {
    id: "s1",
    name: "Grand Fiesta Americana",
    type: "hotel",
    contactPhone: "+52 998 123 4567",
    contactEmail: "reservaciones@grandfiesta.com",
    website: "https://www.grandfiestamericana.com",
    address: "Blvd. Kukulcán Km 16.5, Cancún, Q.Roo",
    notes: "Todo incluido, 5 estrellas, vistas al mar.",
    tags: ["hotel", "lujo", "cancun"],
    createdAt: "2026-07-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z",
  },
  {
    id: "s2",
    name: "María Sazón",
    type: "restaurant",
    contactPhone: "+52 55 2345 6789",
    contactEmail: "contacto@mariasazon.mx",
    website: "https://www.mariasazon.mx",
    address: "Av. Reforma 222, CDMX",
    notes: "Cocina tradicional mexicana, reserva recomendada.",
    tags: ["restaurante", "mexicana", "cdmx"],
    createdAt: "2026-07-02T10:00:00Z",
    updatedAt: "2026-07-02T10:00:00Z",
  },
  {
    id: "s3",
    name: "AeroTransporte Ejecutivo",
    type: "transport",
    contactPhone: "+52 81 3456 7890",
    contactEmail: "reservas@aerotransporte.mx",
    address: "Aeropuerto Internacional MTY, Terminal A",
    notes: "Traslados ejecutivos, flota de vans y sedans.",
    tags: ["transporte", "ejecutivo", "aeropuerto"],
    createdAt: "2026-07-03T10:00:00Z",
    updatedAt: "2026-07-03T10:00:00Z",
  },
  {
    id: "s4",
    name: "Aventuras Mayas Tour Op",
    type: "tour_operator",
    contactPhone: "+52 984 456 7890",
    contactEmail: "info@aventurasmayas.com",
    website: "https://www.aventurasmayas.com",
    address: "Calle 10 x 12, Centro, Playa del Carmen",
    notes: "Tours personalizados en la Riviera Maya.",
    tags: ["tours", "rivieramaya", "aventura"],
    createdAt: "2026-07-04T10:00:00Z",
    updatedAt: "2026-07-04T10:00:00Z",
  },
  {
    id: "s5",
    name: "Distribuidora Turística del Sur",
    type: "other",
    contactPhone: "+52 961 567 8901",
    contactEmail: "ventas@dtsur.mx",
    address: "Av. Central 345, Tuxtla Gutiérrez",
    notes: "Distribución de materiales promocionales.",
    tags: ["promocionales", "sur"],
    createdAt: "2026-07-05T10:00:00Z",
    updatedAt: "2026-07-05T10:00:00Z",
  },
  {
    id: "s6",
    name: "Hotel Ritz CDMX",
    type: "hotel",
    contactPhone: "+52 55 9876 5432",
    contactEmail: "cdmx@ritz.com",
    website: "https://www.ritz.com/cdmx",
    address: "Av. Paseo de la Reforma 100, CDMX",
    tags: ["hotel", "cdmx"],
    createdAt: "2026-07-06T10:00:00Z",
    updatedAt: "2026-07-06T10:00:00Z",
  },
  {
    id: "s7",
    name: "Tacos El Gabo",
    type: "restaurant",
    contactPhone: "+52 33 111 2233",
    address: "Av. Vallarta 500, Guadalajara",
    notes: "Taquería tradicional, horario nocturno.",
    tags: ["restaurante", "guadalajara"],
    createdAt: "2026-07-07T10:00:00Z",
    updatedAt: "2026-07-07T10:00:00Z",
  },
  {
    id: "s8",
    name: "TransExpress Guadalajara",
    type: "transport",
    contactPhone: "+52 33 222 3344",
    contactEmail: "ventas@transexpressgdl.com",
    address: "Av. Ávila Camacho 1500, Guadalajara",
    tags: [],
    createdAt: "2026-07-08T10:00:00Z",
    updatedAt: "2026-07-08T10:00:00Z",
  },
  {
    id: "s9",
    name: "EcoTurismo Patagonia",
    type: "tour_operator",
    contactPhone: "+52 55 333 4455",
    website: "https://www.ecoturismopatagonia.com",
    notes: "Expediciones de lujo en Sudamérica.",
    tags: [],
    createdAt: "2026-07-09T10:00:00Z",
    updatedAt: "2026-07-09T10:00:00Z",
  },
  {
    id: "s10",
    name: "Servicios Turísticos del Norte",
    type: "other",
    contactPhone: "+52 81 444 5566",
    address: "Av. Constitución 800, Monterrey",
    tags: [],
    createdAt: "2026-07-10T10:00:00Z",
    updatedAt: "2026-07-10T10:00:00Z",
  },
];

// Fuente de verdad mock para la asignación many-to-many trip<->client,
// espejo de la tabla trip_clients (ver supabase/migrations/0005_trip_clients.sql).
export const mockTripClients: { tripId: string; clientId: string; createdAt: string }[] = [
  { tripId: "t1", clientId: "c1", createdAt: "2026-07-01T09:00:00Z" },
  { tripId: "t2", clientId: "c2", createdAt: "2026-07-05T09:00:00Z" },
];

// Notas privadas de agente, mantenidas fuera de mockTrips/Trip a propósito:
// getTripWithDetails()/getTripById() nunca las mezclan en el objeto TripWithDetails
// (que sí llega a componentes cliente en /t/[slug]), espejo del hecho de que en
// Supabase tampoco se seleccionan junto con el resto del trip (ver
// supabase/migrations/0025_trip_internal_notes.sql).
export const mockTripInternalNotes: Record<string, string> = {};

// Catálogo mock de tags, espejo de la tabla tags (ver
// supabase/migrations/0006_trip_tags.sql).
export const mockTags: Tag[] = [
  { id: "tg1", name: "Luna de miel", createdAt: "2026-07-01T09:00:00Z" },
  { id: "tg2", name: "Familiar", createdAt: "2026-07-05T09:00:00Z" },
];

// Fuente de verdad mock para la asignación many-to-many trip<->tag, espejo
// de la tabla trip_tags. A diferencia de mockTripClients, 0 tags es válido.
export const mockTripTags: { tripId: string; tagId: string; createdAt: string }[] = [
  { tripId: "t1", tagId: "tg1", createdAt: "2026-07-01T09:00:00Z" },
  { tripId: "t2", tagId: "tg2", createdAt: "2026-07-05T09:00:00Z" },
];

// Historial mock de transiciones de status por viaje (issue #55), espejo de
// la tabla trip_status_history (ver
// supabase/migrations/0024_trip_status_history.sql). Append-only: nunca se
// muta ni se borra una fila existente, solo se agregan nuevas.
export const mockTripStatusHistory: TripStatusHistoryEntry[] = [
  {
    id: "tsh1",
    tripId: "t1",
    fromStatus: null,
    toStatus: "draft",
    changedAt: "2026-07-01T09:00:00Z",
  },
  {
    id: "tsh2",
    tripId: "t1",
    fromStatus: "draft",
    toStatus: "published",
    changedAt: "2026-07-02T09:00:00Z",
  },
];

// Galería mock de fotos por viaje, espejo de la tabla trip_photos (ver
// supabase/migrations/0012_trip_photos.sql). filePath queda como URL externa
// completa en modo mock (no hay bucket real), a diferencia de Supabase donde
// es una ruta relativa dentro del bucket "trip-photos".
export const mockTripPhotos: TripPhoto[] = [
  {
    id: "ph1",
    tripId: "t1",
    filePath: "https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800",
    fileName: "coliseo.jpg",
    sortOrder: 0,
    createdAt: "2026-07-02T09:00:00Z",
  },
];

// Checklist de equipaje mock, espejo de la tabla packing_items (ver
// supabase/migrations/0009_packing_items.sql). 0 items es válido.
export const mockPackingItems: PackingItem[] = [
  { id: "p1", tripId: "t1", label: "Pasaportes", checked: true, sortOrder: 0 },
  { id: "p2", tripId: "t1", label: "Adaptador de corriente EU", checked: false, sortOrder: 1 },
];

// Fuente de verdad mock para la asignación many-to-many client<->tag, espejo
// de la tabla client_tags (ver supabase/migrations/0008_client_tags.sql).
// Igual que mockTripTags, 0 tags es válido.
export const mockClientTags: { clientId: string; tagId: string; createdAt: string }[] = [
  { clientId: "c1", tagId: "tg1", createdAt: "2026-07-01T09:00:00Z" },
];

export const mockItems: Item[] = [
  {
    id: "i1",
    tripDayId: "d1",
    type: "flight",
    title: "Vuelo AeroMéxico AM45 CDMX -> Roma",
    startTime: "08:30",
    endTime: "14:20",
    location: "Aeropuerto Internacional CDMX",
    confirmationCode: "XJ4K9P",
    cost: 12500,
    sortOrder: 0,
    metadata: {
      airline: "AeroMéxico",
      flightNumber: "AM45",
      departureAirport: "MEX",
      arrivalAirport: "FCO",
      departureTime: "08:30",
      arrivalTime: "14:20",
      terminal: "2",
      bookingReference: "XJ4K9P",
    },
  },
  {
    id: "i2",
    tripDayId: "d1",
    type: "hotel",
    title: "Check-in Hotel Artemide",
    startTime: "16:00",
    location: "Via Nazionale 22, Roma",
    lat: 41.9028,
    lng: 12.4964,
    confirmationCode: "HTL-88213",
    cost: 3200,
    sortOrder: 1,
    metadata: {
      hotelName: "Hotel Artemide",
      address: "Via Nazionale 22, Roma",
      checkIn: "2026-09-10",
      checkOut: "2026-09-17",
      roomType: "Doble Superior",
      boardBasis: "Desayuno incluido",
      hotelPhone: "+39 06 1234 5678",
    },
  },
  {
    id: "i3",
    tripDayId: "d2",
    type: "activity",
    title: "Tour privado Coliseo Romano",
    startTime: "10:00",
    endTime: "13:00",
    location: "Piazza del Colosseo, 1",
    lat: 41.8902,
    lng: 12.4922,
    notes: "Guía en español, punto de encuentro en la entrada norte.",
    cost: 900,
    sortOrder: 0,
    metadata: {
      activityName: "Tour privado Coliseo Romano",
      provider: "Viator",
      address: "Piazza del Colosseo, 1, Roma",
      startTime: "10:00",
      endTime: "13:00",
      duration: "3 horas",
      ticketType: "Entrada preferente",
      includes: "Guía en español, entradas sin fila",
      meetingPoint: "Entrada norte del Coliseo",
    },
  },
  {
    id: "i4",
    tripDayId: "d2",
    type: "restaurant",
    title: "Cena en Roscioli",
    startTime: "20:00",
    location: "Via dei Giubbonari, 21, Roma",
    sortOrder: 1,
    metadata: {
      restaurantName: "Roscioli",
      address: "Via dei Giubbonari, 21, Roma",
      cuisine: "Italiana",
      dressCode: "Casual elegante",
      phone: "+39 06 1234 5678",
    },
  },
];

export function getTripWithDetails(slug: string): TripWithDetails | null {
  const trip = mockTrips.find((t) => t.slug === slug);
  if (!trip) return null;
  const clients = mockTripClients
    .filter((tc) => tc.tripId === trip.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((tc) => mockClients.find((c) => c.id === tc.clientId))
    .filter((c): c is Client => Boolean(c));
  const client = clients[0] ?? ({} as Client);
  const tags = mockTripTags
    .filter((tt) => tt.tripId === trip.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((tt) => mockTags.find((t) => t.id === tt.tagId))
    .filter((t): t is Tag => Boolean(t));
  const photos = mockTripPhotos
    .filter((p) => p.tripId === trip.id)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => ({ ...p, url: p.filePath }));
  const supplierIds = [
    ...new Set(
      mockItems
        .filter((i) => i.tripDayId && i.supplierId)
        .map((i) => i.supplierId as string)
    ),
  ];
  const supplierInfo = new Map(
    mockSuppliers
      .filter((s) => supplierIds.includes(s.id))
      .map((s) => [s.id, { name: s.name, address: s.address, lat: s.lat, lng: s.lng }])
  );

  const days = mockTripDays
    .filter((d) => d.tripId === trip.id && !d.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((day) => ({
      ...day,
      items: mockItems
        .filter((i) => i.tripDayId === day.id && !i.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          ...item,
          supplier: item.supplierId ? supplierInfo.get(item.supplierId) : undefined,
        })),
    }));
  const statusHistory = mockTripStatusHistory
    .filter((h) => h.tripId === trip.id)
    .sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  const packingItems = mockPackingItems
    .filter((p) => p.tripId === trip.id)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return { ...trip, clients, client, tags, statusHistory, photos, days, packingItems };
}

export function getTripById(id: string): TripWithDetails | null {
  const trip = mockTrips.find((t) => t.id === id);
  return trip ? getTripWithDetails(trip.slug) : null;
}

// Mismos valores placeholder que la semilla de la migración 0005, para
// que el modo mock y el modo Supabase se comporten igual por defecto.
export const mockSiteSettings: SiteSettings = {
  email: "contacto@example.com",
  phone: "+52 000 000 0000",
};

// Feedback del cliente post-viaje (issue #46), espejo de la tabla
// trip_feedback. Vacío por defecto: sin datos de prueba precargados.
export const mockTripFeedback: TripFeedback[] = [];

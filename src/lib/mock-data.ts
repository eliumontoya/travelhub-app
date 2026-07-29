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
  const days = mockTripDays
    .filter((d) => d.tripId === trip.id && !d.deletedAt)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((day) => ({
      ...day,
      items: mockItems
        .filter((i) => i.tripDayId === day.id && !i.deletedAt)
        .sort((a, b) => a.sortOrder - b.sortOrder),
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

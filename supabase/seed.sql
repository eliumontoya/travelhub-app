-- TravelHub — seed de desarrollo local (issue #372, fase 1).
--
-- Espeja los fixtures de src/lib/mock-data.ts para que la app pueda correr
-- contra Postgres local (Supabase CLI) con el switch de Supabase activo.
-- `supabase db reset` arranca desde base vacía: aplica migraciones y luego
-- este archivo. Son inserts planos, sin DROP ni borrado de tablas de usuario.
--
-- Credenciales de desarrollo (NO usar fuera de local):
--   admin@travelhub.test / password123  (rol admin)
--   agent@travelhub.test / password123  (rol agent, travel_agent a1)
--   Cliente c1 (Ana y Roberto Pérez) con PIN 123456
--
-- IDs deterministas (uuid) para poder mapear los ids mock (c1, t1, i1, …):
--   auth admin      -> 00000000-0000-4000-8000-000000000001
--   auth agent      -> 00000000-0000-4000-8000-000000000002
--   travel_agent a1 -> a1000000-0000-4000-8000-000000000001
--   travel_agent a2 -> a2000000-0000-4000-8000-000000000002
--   client c1       -> c1000000-0000-4000-8000-000000000001
--   client c2       -> c2000000-0000-4000-8000-000000000002
--   trip t1         -> 11111111-1111-4111-8111-111111111111
--   trip t2         -> 22222222-2222-4222-8222-222222222222
--   day d1/d2       -> d1000000-… / d2000000-…
--   item i1..i4     -> e1000000-… / e2000000-… / e3000000-… / e4000000-…
--   tag tg1/tg2     -> b1000000-… / b2000000-…
--   supplier s6..s10-> 5a600000-… … 5aa00000-…
--   packing p1/p2   -> f1000000-… / f2000000-…

-- ============================================================
-- Auth: usuarios de desarrollo + perfiles de autorización.
-- El login por email/password de GoTrue requiere fila en auth.users y su
-- identidad en auth.identities. bcrypt vía pgcrypto (extensions.crypt).
-- ============================================================

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000001',
    'authenticated', 'authenticated', 'admin@travelhub.test',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-4000-8000-000000000002',
    'authenticated', 'authenticated', 'agent@travelhub.test',
    crypt('password123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now(),
    '', '', '', ''
  );

insert into auth.identities (
  user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) values
  (
    '00000000-0000-4000-8000-000000000001',
    '{"sub":"00000000-0000-4000-8000-000000000001","email":"admin@travelhub.test","email_verified":true}',
    'email', '00000000-0000-4000-8000-000000000001', now(), now(), now()
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    '{"sub":"00000000-0000-4000-8000-000000000002","email":"agent@travelhub.test","email_verified":true}',
    'email', '00000000-0000-4000-8000-000000000002', now(), now(), now()
  );

-- ============================================================
-- travel_agents (catálogo) — espejo de mockTravelAgents a1/a2.
-- Debe ir antes de profiles y trips (FKs).
-- ============================================================

insert into travel_agents (id, name, email, phone, notes, created_at, updated_at) values
  ('a1000000-0000-4000-8000-000000000001', 'Eliu Montoya', 'eliu@example.com', '+52 55 1234 5678', 'Agente principal', '2026-07-01T10:00:00Z', '2026-07-01T10:00:00Z'),
  ('a2000000-0000-4000-8000-000000000002', 'María González', 'maria@example.com', null, null, '2026-07-02T10:00:00Z', '2026-07-02T10:00:00Z');

-- profiles: espejo de mockProfiles. Admin sin features; agent con
-- features {trips, clients} y travel_agent_id a1.
insert into profiles (id, role, features, travel_agent_id, created_at, updated_at) values
  ('00000000-0000-4000-8000-000000000001', 'admin', '{}', null, now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'agent', '{trips,clients}', 'a1000000-0000-4000-8000-000000000001', now(), now());

-- ============================================================
-- suppliers — la migración 0029 ya sembró 5 (equivalentes a s1..s5) y la
-- 0030 sus tags. Se completan los 5 restantes de mockSuppliers y se fija el
-- google_place_id que mock provee para s1/s2.
-- ============================================================

update suppliers set google_place_id = 'mock-place-grand-fiesta-americana'
where name = 'Grand Fiesta Americana' and google_place_id is null;
update suppliers set google_place_id = 'mock-place-maria-sazon'
where name = 'María Sazón' and google_place_id is null;

insert into suppliers (id, name, type, contact_phone, contact_email, website, address, notes, tags, created_at, updated_at) values
  ('5a600000-0000-4000-8000-000000000006', 'Hotel Ritz CDMX', 'hotel', '+52 55 9876 5432', 'cdmx@ritz.com', 'https://www.ritz.com/cdmx', 'Av. Paseo de la Reforma 100, CDMX', null, '{hotel,cdmx}', '2026-07-06T10:00:00Z', '2026-07-06T10:00:00Z'),
  ('5a700000-0000-4000-8000-000000000007', 'Tacos El Gabo', 'restaurant', '+52 33 111 2233', null, null, 'Av. Vallarta 500, Guadalajara', 'Taquería tradicional, horario nocturno.', '{restaurante,guadalajara}', '2026-07-07T10:00:00Z', '2026-07-07T10:00:00Z'),
  ('5a800000-0000-4000-8000-000000000008', 'TransExpress Guadalajara', 'transport', '+52 33 222 3344', 'ventas@transexpressgdl.com', null, 'Av. Ávila Camacho 1500, Guadalajara', null, '{}', '2026-07-08T10:00:00Z', '2026-07-08T10:00:00Z'),
  ('5a900000-0000-4000-8000-000000000009', 'EcoTurismo Patagonia', 'tour_operator', '+52 55 333 4455', null, 'https://www.ecoturismopatagonia.com', null, 'Expediciones de lujo en Sudamérica.', '{}', '2026-07-09T10:00:00Z', '2026-07-09T10:00:00Z'),
  ('5aa00000-0000-4000-8000-000000000010', 'Servicios Turísticos del Norte', 'other', '+52 81 444 5566', null, null, 'Av. Constitución 800, Monterrey', null, '{}', '2026-07-10T10:00:00Z', '2026-07-10T10:00:00Z');

-- ============================================================
-- clients — espejo de mockClients c1/c2 (slugs públicos incluidos).
-- c1 lleva pin_hash bcrypt de '123456' para el login de clientes.
-- ============================================================

insert into clients (
  id, name, email, phone, whatsapp, notes, birth_date, cover_image_url,
  slug, pin_hash, created_at, updated_at
) values
  (
    'c1000000-0000-4000-8000-000000000001', 'Ana y Roberto Pérez',
    'ana.perez@example.com', '+52 55 1234 5678', '+52 55 1234 5678',
    'Luna de miel, prefieren hoteles boutique.', '1990-08-01',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=70',
    'ana-y-roberto-perez', crypt('123456', gen_salt('bf')),
    '2026-06-01T10:00:00Z', '2026-06-01T10:00:00Z'
  ),
  (
    'c2000000-0000-4000-8000-000000000002', 'Familia Gómez',
    'gomez.family@example.com', '+52 33 9876 5432', '+52 33 9876 5432',
    '4 personas, 2 niños, buscan actividades familiares.', null, null,
    'familia-gomez', null, '2026-06-10T10:00:00Z', '2026-06-10T10:00:00Z'
  );

-- ============================================================
-- trips + relaciones — espejo de mockTrips/mockTripClients/mockTripTags.
-- t1: publicado (slug italia-perez-2026), cliente c1, agente a1.
-- t2: borrador, cliente c2.
-- ============================================================

insert into trips (
  id, client_id, title, slug, start_date, end_date, cover_image_url,
  instructions, traveler_count, status, currency, is_template,
  show_costs_to_client, assigned_agent_id, created_at, updated_at
) values
  (
    '11111111-1111-4111-8111-111111111111', 'c1000000-0000-4000-8000-000000000001',
    'Luna de miel en Italia', 'italia-perez-2026', '2026-09-10', '2026-09-17',
    'https://images.unsplash.com/photo-1499678329028-101435549a4e?w=1200',
    '¡Bienvenidos! Llegada al hotel a partir de las 15:00. Contacto de emergencia 24/7: +39 06 1234 5678. Lleven documento de identidad para el check-in.',
    2, 'published', 'EUR', false, true, 'a1000000-0000-4000-8000-000000000001',
    '2026-07-01T09:00:00Z', '2026-07-01T09:00:00Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222', 'c2000000-0000-4000-8000-000000000002',
    'Aventura en Cancún', 'cancun-gomez-2026', '2026-12-15', '2026-12-20',
    null, null, 4, 'draft', 'MXN', false, false, null,
    '2026-07-05T09:00:00Z', '2026-07-05T09:00:00Z'
  );

insert into trip_clients (trip_id, client_id, created_at) values
  ('11111111-1111-4111-8111-111111111111', 'c1000000-0000-4000-8000-000000000001', '2026-07-01T09:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'c2000000-0000-4000-8000-000000000002', '2026-07-05T09:00:00Z');

-- ============================================================
-- tags + trip_tags + client_tags — espejo de mockTags.
-- ============================================================

insert into tags (id, name, created_at) values
  ('b1000000-0000-4000-8000-000000000001', 'Luna de miel', '2026-07-01T09:00:00Z'),
  ('b2000000-0000-4000-8000-000000000002', 'Familiar', '2026-07-05T09:00:00Z');

insert into trip_tags (trip_id, tag_id, created_at) values
  ('11111111-1111-4111-8111-111111111111', 'b1000000-0000-4000-8000-000000000001', '2026-07-01T09:00:00Z'),
  ('22222222-2222-4222-8222-222222222222', 'b2000000-0000-4000-8000-000000000002', '2026-07-05T09:00:00Z');

insert into client_tags (client_id, tag_id, created_at) values
  ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', '2026-07-01T09:00:00Z');

-- ============================================================
-- trip_days + items — espejo de mockTripDays/mockItems.
-- Ojo: la columna JSONB de items se llama item_metadata (migración 0028).
-- ============================================================

insert into trip_days (id, trip_id, date, sort_order) values
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', '2026-09-10', 0),
  ('d2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', '2026-09-11', 1);

insert into items (
  id, trip_day_id, type, title, start_time, end_time, location, lat, lng,
  confirmation_code, notes, sort_order, cost, item_metadata
) values
  (
    'e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001',
    'flight', 'Vuelo AeroMéxico AM45 CDMX -> Roma', '08:30', '14:20',
    'Aeropuerto Internacional CDMX', null, null, 'XJ4K9P', null, 0, 12500,
    '{"airline":"AeroMéxico","flightNumber":"AM45","departureAirport":"MEX","arrivalAirport":"FCO","departureTime":"08:30","arrivalTime":"14:20","terminal":"2","bookingReference":"XJ4K9P"}'
  ),
  (
    'e2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001',
    'hotel', 'Check-in Hotel Artemide', '16:00', null, 'Via Nazionale 22, Roma',
    41.9028, 12.4964, 'HTL-88213', null, 1, 3200,
    '{"hotelName":"Hotel Artemide","address":"Via Nazionale 22, Roma","checkIn":"2026-09-10","checkOut":"2026-09-17","roomType":"Doble Superior","boardBasis":"Desayuno incluido","hotelPhone":"+39 06 1234 5678"}'
  ),
  (
    'e3000000-0000-4000-8000-000000000003', 'd2000000-0000-4000-8000-000000000002',
    'activity', 'Tour privado Coliseo Romano', '10:00', '13:00', 'Piazza del Colosseo, 1',
    41.8902, 12.4922, null, 'Guía en español, punto de encuentro en la entrada norte.', 0, 900,
    '{"activityName":"Tour privado Coliseo Romano","provider":"Viator","address":"Piazza del Colosseo, 1, Roma","startTime":"10:00","endTime":"13:00","duration":"3 horas","ticketType":"Entrada preferente","includes":"Guía en español, entradas sin fila","meetingPoint":"Entrada norte del Coliseo"}'
  ),
  (
    'e4000000-0000-4000-8000-000000000004', 'd2000000-0000-4000-8000-000000000002',
    'restaurant', 'Cena en Roscioli', '20:00', null, 'Via dei Giubbonari, 21, Roma',
    null, null, null, null, 1, null,
    '{"restaurantName":"Roscioli","address":"Via dei Giubbonari, 21, Roma","cuisine":"Italiana","dressCode":"Casual elegante","phone":"+39 06 1234 5678"}'
  );

-- ============================================================
-- packing_items, trip_photos, trip_status_history — espejo de
-- mockPackingItems/mockTripPhotos/mockTripStatusHistory (solo t1).
-- ============================================================

insert into packing_items (id, trip_id, label, checked, sort_order) values
  ('f1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'Pasaportes', true, 0),
  ('f2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'Adaptador de corriente EU', false, 1);

insert into trip_photos (id, trip_id, file_path, file_name, sort_order, created_at) values
  ('de100000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'https://images.unsplash.com/photo-1531572753322-ad063cecc140?w=800', 'coliseo.jpg', 0, '2026-07-02T09:00:00Z');

insert into trip_status_history (id, trip_id, from_status, to_status, changed_at) values
  ('db100000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', null, 'draft', '2026-07-01T09:00:00Z'),
  ('db200000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'draft', 'published', '2026-07-02T09:00:00Z');

-- ============================================================
-- services / service_checklist_items / service_uploads (issue #312) —
-- espejo de mockServices/mockServiceChecklistItems/mockServiceUploads.
-- ============================================================

insert into services (id, trip_id, client_id, service_type, status, created_at, updated_at) values
  ('5c100000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'c1000000-0000-4000-8000-000000000001', 'trip_documents', 'active', '2026-07-01T09:00:00Z', '2026-07-01T09:00:00Z');

insert into service_checklist_items (id, service_id, label, required, sort_order, created_at, updated_at) values
  ('5c210000-0000-4000-8000-000000000001', '5c100000-0000-4000-8000-000000000001', 'Pasaporte', true, 0, '2026-07-01T09:00:00Z', '2026-07-01T09:00:00Z'),
  ('5c220000-0000-4000-8000-000000000002', '5c100000-0000-4000-8000-000000000001', 'Seguro de viaje', false, 1, '2026-07-01T09:00:00Z', '2026-07-01T09:00:00Z'),
  ('5c230000-0000-4000-8000-000000000003', '5c100000-0000-4000-8000-000000000001', 'Visado', true, 2, '2026-07-01T09:00:00Z', '2026-07-01T09:00:00Z');

insert into service_uploads (
  id, service_id, checklist_item_id, file_path, filename, mime_type,
  status, file_removed, uploaded_at, updated_at
) values
  (
    '5c310000-0000-4000-8000-000000000001', '5c100000-0000-4000-8000-000000000001',
    '5c210000-0000-4000-8000-000000000001',
    'services/svc1/sci1/1000000000000-pasaporte.pdf', 'pasaporte.pdf', 'application/pdf',
    'processed', true, '2026-07-02T09:00:00Z', '2026-07-02T09:00:00Z'
  ),
  (
    '5c320000-0000-4000-8000-000000000002', '5c100000-0000-4000-8000-000000000001',
    '5c220000-0000-4000-8000-000000000002',
    'services/svc1/sci2/1000000000001-seguro.pdf', 'seguro.pdf', 'application/pdf',
    'uploaded', false, '2026-07-02T09:00:00Z', '2026-07-02T09:00:00Z'
  );

-- ============================================================
-- visas / visa_clients / visa_status_history / visa_documents —
-- espejo de mockVisas/mockVisaClients/mockVisaStatusHistory/mockVisaDocuments.
-- ============================================================

insert into visas (id, client_id, country, visa_type, deadline, price, notes, status, created_at, updated_at) values
  ('7a100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'France', 'Tourist', '2026-12-01', 150, 'Honeymoon visa', 'pending', '2026-09-30T10:00:00Z', '2026-09-30T10:00:00Z'),
  ('7a200000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', 'Japan', 'Business', '2026-11-15', 200, null, 'in_progress', '2026-09-29T10:00:00Z', '2026-09-29T10:00:00Z');

insert into visa_clients (visa_id, client_id, created_at) values
  ('7a100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', '2026-09-30T10:00:00Z'),
  ('7a200000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002', '2026-09-29T10:00:00Z');

insert into visa_status_history (id, visa_id, from_status, to_status, changed_at) values
  ('7b100000-0000-4000-8000-000000000001', '7a100000-0000-4000-8000-000000000001', null, 'pending', '2026-09-30T10:00:00Z'),
  ('7b200000-0000-4000-8000-000000000002', '7a200000-0000-4000-8000-000000000002', null, 'pending', '2026-09-29T10:00:00Z'),
  ('7b300000-0000-4000-8000-000000000003', '7a200000-0000-4000-8000-000000000002', 'pending', 'in_progress', '2026-09-29T11:00:00Z');

insert into visa_documents (
  id, visa_id, target_client_id, description, file_path, filename, mime_type,
  status, uploaded_at, created_at, updated_at
) values
  (
    '7c100000-0000-4000-8000-000000000001', '7a100000-0000-4000-8000-000000000001', null,
    'Visa application form (signed)', 'visas/v1/vd1-application-form.pdf', 'application-form.pdf', 'application/pdf',
    'uploaded', '2026-09-30T10:00:00Z', '2026-09-30T10:00:00Z', '2026-09-30T10:00:00Z'
  ),
  (
    '7c200000-0000-4000-8000-000000000002', '7a200000-0000-4000-8000-000000000002', 'c2000000-0000-4000-8000-000000000002',
    'Passport scan', null, null, null,
    'requested', null, '2026-09-29T10:00:00Z', '2026-09-29T10:00:00Z'
  );

-- Catálogo de proveedores (hoteles, restaurantes, transportes, tour operadores,
-- otros). Monousuario: RLS permite todo al dueño autenticado.
-- Additive only: no elimina ni renombra columnas existentes.

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'other',
  contact_phone text,
  contact_email text,
  website text,
  address text,
  lat numeric,
  lng numeric,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table suppliers enable row level security;

create policy "Owners can do everything on suppliers"
  on suppliers
  using (true);

-- FK nullable en items: si se borra el proveedor, los items no se eliminan
-- (ON DELETE SET NULL conserva los datos del item, solo pierde la referencia).
alter table items
  add column if not exists supplier_id uuid references suppliers(id) on delete set null;

-- Seed: 5 proveedores de ejemplo cubriendo todos los tipos
insert into suppliers (name, type, contact_phone, contact_email, website, address, notes) values
  ('Grand Fiesta Americana', 'hotel', '+52 998 123 4567', 'reservaciones@grandfiesta.com', 'https://www.grandfiestamericana.com', 'Blvd. Kukulcán Km 16.5, Cancún, Q.Roo', 'Todo incluido, 5 estrellas, vistas al mar'),
  ('María Sazón', 'restaurant', '+52 55 2345 6789', 'contacto@mariasazon.mx', 'https://www.mariasazon.mx', 'Av. Reforma 222, CDMX', 'Cocina tradicional mexicana, reserva recomendada'),
  ('AeroTransporte Ejecutivo', 'transport', '+52 81 3456 7890', 'reservas@aerotransporte.mx', null, 'Aeropuerto Internacional MTY, Terminal A', 'Traslados ejecutivos, flota de vans y sedans'),
  ('Aventuras Mayas Tour Op', 'tour_operator', '+52 984 456 7890', 'info@aventurasmayas.com', 'https://www.aventurasmayas.com', 'Calle 10 x 12, Centro, Playa del Carmen', 'Tours personalizados en la Riviera Maya'),
  ('Distribuidora Turística del Sur', 'other', '+52 961 567 8901', 'ventas@dtsur.mx', null, 'Av. Central 345, Tuxtla Gutiérrez', 'Distribución de materiales promocionales');

create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  auth_user_id uuid,
  name text not null,
  phone text not null,
  whatsapp text,
  cpf text,
  photo_url text,
  vehicle_type text not null default 'motorcycle',
  vehicle_model text,
  vehicle_plate text,
  license_number text,
  license_expires_at date,
  emergency_contact text,
  payment_rule text not null default 'fixed',
  default_delivery_value numeric(12,2) not null default 0,
  registration_status text not null default 'invited',
  availability_status text not null default 'offline',
  gps_consent_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  id bigint generated always as identity primary key,
  driver_id uuid not null references public.drivers(id) on delete cascade,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy_meters numeric(10,2),
  heading numeric(7,2),
  speed_mps numeric(8,2),
  recorded_at timestamptz not null default now()
);

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  driver_id uuid references public.drivers(id) on delete set null,
  tracking_code text not null unique,
  status text not null default 'waiting_assignment',
  pickup_address jsonb not null default '{}'::jsonb,
  delivery_address jsonb not null default '{}'::jsonb,
  delivery_value numeric(12,2) not null default 0,
  amount_to_collect numeric(12,2) not null default 0,
  offered_at timestamptz,
  accepted_at timestamptz,
  arrived_store_at timestamptz,
  picked_up_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  confirmation_code text,
  proof_photo_url text,
  problem_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.delivery_events (
  id bigint generated always as identity primary key,
  delivery_id uuid not null references public.deliveries(id) on delete cascade,
  event_type text not null,
  actor_type text not null,
  actor_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_drivers_company_status on public.drivers(company_id, availability_status);
create index if not exists idx_driver_locations_driver_time on public.driver_locations(driver_id, recorded_at desc);
create index if not exists idx_deliveries_company_status on public.deliveries(company_id, status);
create index if not exists idx_deliveries_driver_status on public.deliveries(driver_id, status);
create index if not exists idx_delivery_events_delivery_time on public.delivery_events(delivery_id, created_at);

alter table public.drivers enable row level security;
alter table public.driver_locations enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_events enable row level security;

-- As políticas definitivas dependem da autenticação multiempresa.
-- Nunca disponibilizar o histórico completo de localização ao cliente.

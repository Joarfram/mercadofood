-- MercadoFood v0.4: autenticação, multiempresa e políticas RLS
create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text unique,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','attendant','kitchen','driver')),
  created_at timestamptz not null default now(),
  unique(company_id, user_id)
);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;

create policy "owner can read own companies" on public.companies
for select using (owner_id = auth.uid());
create policy "owner can insert company" on public.companies
for insert with check (owner_id = auth.uid());
create policy "owner can update own companies" on public.companies
for update using (owner_id = auth.uid());

create policy "members can read own membership" on public.company_members
for select using (user_id = auth.uid());
create policy "owner manages members" on public.company_members
for all using (
  exists(select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
) with check (
  exists(select 1 from public.companies c where c.id = company_id and c.owner_id = auth.uid())
);

-- Adaptação segura das tabelas existentes para multiempresa.
alter table if exists public.products add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table if exists public.orders add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table if exists public.drivers add column if not exists company_id uuid references public.companies(id) on delete cascade;
alter table if exists public.deliveries add column if not exists company_id uuid references public.companies(id) on delete cascade;

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.companies c where c.id = target_company and c.owner_id = auth.uid()
  ) or exists (
    select 1 from public.company_members m where m.company_id = target_company and m.user_id = auth.uid()
  );
$$;

alter table if exists public.products enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.drivers enable row level security;
alter table if exists public.deliveries enable row level security;

-- As políticas abaixo podem ser executadas uma única vez em projeto novo.
do $$ begin
  create policy "company products" on public.products for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company orders" on public.orders for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company drivers" on public.drivers for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "company deliveries" on public.deliveries for all using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

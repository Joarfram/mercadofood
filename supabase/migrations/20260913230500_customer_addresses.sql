create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  label text not null default 'Principal',
  cep text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  reference text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_addresses_company_customer_idx on public.customer_addresses(company_id, customer_id);
create unique index if not exists customer_addresses_one_default_idx on public.customer_addresses(customer_id) where is_default;

alter table public.customer_addresses enable row level security;

drop policy if exists "company customer addresses" on public.customer_addresses;
create policy "company customer addresses" on public.customer_addresses
for all using (public.is_company_member(company_id))
with check (public.is_company_member(company_id));

create or replace function public.set_customer_address_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_customer_address_updated_at on public.customer_addresses;
create trigger trg_customer_address_updated_at
before update on public.customer_addresses
for each row execute function public.set_customer_address_updated_at();

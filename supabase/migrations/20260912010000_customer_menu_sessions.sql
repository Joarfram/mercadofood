-- Mantem o cliente reconhecido no cardapio e exibe o pedido ate o fechamento explicito.
create schema if not exists private;

create table if not exists public.customer_menu_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_customer_menu_sessions_lookup
  on public.customer_menu_sessions(company_id, token_hash, expires_at);

alter table public.customer_menu_sessions enable row level security;
revoke all on table public.customer_menu_sessions from anon, authenticated;
grant select, insert, update, delete on table public.customer_menu_sessions to service_role;

alter table public.orders
  add column if not exists estimated_preparation_minutes integer,
  add column if not exists estimated_ready_at timestamptz,
  add column if not exists customer_closed_at timestamptz;

create index if not exists idx_orders_customer_visible
  on public.orders(company_id, customer_id, customer_closed_at, created_at desc);

create or replace function private.set_order_preparation_estimate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  configured_minutes integer;
begin
  select greatest(5, least(300, coalesce(c.average_delivery_minutes, 45)))
    into configured_minutes
  from public.companies c
  where c.id = new.company_id;

  new.estimated_preparation_minutes := coalesce(new.estimated_preparation_minutes, configured_minutes, 45);
  new.estimated_ready_at := coalesce(
    new.estimated_ready_at,
    coalesce(new.accepted_at, new.created_at, now()) + make_interval(mins => new.estimated_preparation_minutes)
  );
  return new;
end;
$$;

revoke all on function private.set_order_preparation_estimate() from public, anon, authenticated;

drop trigger if exists orders_set_preparation_estimate on public.orders;
create trigger orders_set_preparation_estimate
before insert on public.orders
for each row execute function private.set_order_preparation_estimate();

update public.orders o
set estimated_preparation_minutes = coalesce(o.estimated_preparation_minutes, c.average_delivery_minutes, 45),
    estimated_ready_at = coalesce(
      o.estimated_ready_at,
      coalesce(o.accepted_at, o.created_at) + make_interval(mins => coalesce(c.average_delivery_minutes, 45))
    )
from public.companies c
where c.id = o.company_id
  and (o.estimated_preparation_minutes is null or o.estimated_ready_at is null);

update public.orders
set customer_closed_at = coalesce(delivered_at, canceled_at, updated_at, now())
where customer_closed_at is null
  and status in ('delivered', 'canceled');

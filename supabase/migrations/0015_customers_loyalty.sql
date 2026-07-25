-- MercadoFood v1.6: clientes, histórico e programa de fidelidade
alter table public.customers add column if not exists birth_date date;
alter table public.customers add column if not exists notes text;
alter table public.customers add column if not exists loyalty_points integer not null default 0;
alter table public.customers add column if not exists is_active boolean not null default true;

create table if not exists public.loyalty_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  is_enabled boolean not null default true,
  points_per_currency numeric(10,2) not null default 1,
  minimum_order_value numeric(12,2) not null default 0,
  reward_name text not null default 'Desconto fidelidade',
  reward_points integer not null default 100,
  reward_value numeric(12,2) not null default 10,
  points_expire_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.loyalty_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  movement_type text not null check (movement_type in ('earn','redeem','adjustment','expire','reversal')),
  points integer not null,
  balance_after integer not null,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_customers_company_activity on public.customers(company_id, is_active, last_order_at desc);
create index if not exists idx_loyalty_movements_customer on public.loyalty_movements(customer_id, created_at desc);
create unique index if not exists idx_loyalty_order_earn_unique on public.loyalty_movements(order_id) where movement_type = 'earn';

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_movements enable row level security;

do $$ begin
  create policy "company loyalty settings" on public.loyalty_settings for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "company loyalty movements" on public.loyalty_movements for all
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
exception when duplicate_object then null; end $$;

create or replace function public.update_customer_after_delivery()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  cfg public.loyalty_settings%rowtype;
  earned integer := 0;
  current_balance integer := 0;
begin
  if new.status = 'delivered' and old.status is distinct from 'delivered' and new.customer_id is not null then
    update public.customers
      set total_orders = total_orders + 1,
          total_spent = total_spent + new.total,
          last_order_at = coalesce(new.delivered_at, now()),
          updated_at = now()
      where id = new.customer_id;

    select * into cfg from public.loyalty_settings where company_id = new.company_id;
    if found and cfg.is_enabled and new.total >= cfg.minimum_order_value then
      earned := floor(new.total * cfg.points_per_currency)::integer;
      if earned > 0 then
        update public.customers
          set loyalty_points = loyalty_points + earned,
              updated_at = now()
          where id = new.customer_id
          returning loyalty_points into current_balance;

        insert into public.loyalty_movements(company_id, customer_id, order_id, movement_type, points, balance_after, description)
        values(new.company_id, new.customer_id, new.id, 'earn', earned, current_balance, 'Pontos do pedido #' || new.order_number)
        on conflict do nothing;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_customer_delivery on public.orders;
create trigger trg_customer_delivery
after update of status on public.orders
for each row execute function public.update_customer_after_delivery();
